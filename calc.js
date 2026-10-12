/*
 * Calculation engine for the AS/NZS 1170.2:2021 basic wind actions calculator.
 * Clause references are given in comments so results can be traced back to the Standard.
 * Depends on the tables defined in data.js (load data.js before this file).
 */

// -- generic helpers ---------------------------------------------------------

function lerp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

// Piecewise-linear interpolation over a sorted array of x-values / y-values.
// Clamps to the end values outside the table range (matches how AS/NZS 1170.2
// tables are used in practice -- e.g. Mz,cat and Ms note "linear interpolation"
// for intermediate values and give no guidance below/above the tabulated range).
function interpTable(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) {
      return lerp(x, xs[i], xs[i + 1], ys[i], ys[i + 1]);
    }
  }
  return ys[ys.length - 1];
}

function angleDiff(a, b) {
  // smallest signed difference a-b, wrapped to [-180,180]
  let d = ((a - b + 540) % 360) - 180;
  return d;
}

// -- Section 3 -- Regional wind speed, direction multiplier, climate change --

const VR_STANDARD_R = [1, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

function getVR(regionKey, R) {
  const region = REGIONS[regionKey];
  const isAU = region.country === "AU";
  const table = isAU ? VR_TABLE_AU : VR_TABLE_NZ;
  const formula = isAU ? VR_FORMULA_AU : VR_FORMULA_NZ;
  const col = region.vrCol;

  if (VR_STANDARD_R.includes(R)) {
    return { value: table[R][col], source: `Table 3.1(${isAU ? "A" : "B"}), R=${R}` };
  }
  if (R >= 5) {
    return { value: formula[col](R), source: `Formula, Table 3.1(${isAU ? "A" : "B"})` };
  }
  // R < 5 and not R=1: not defined by the Standard -- fall back to V1 with a warning.
  return { value: table[1][col], source: "V1 (R<5 not defined by the Standard; using V1)", warning: true };
}

function getMd(regionKey, cardinal) {
  const region = REGIONS[regionKey];
  const idx = CARDINALS.indexOf(cardinal);
  const table = region.country === "AU" ? MD_AU : MD_NZ;
  return table[region.mdCol][idx];
}

function getMc(regionKey) {
  return REGIONS[regionKey].mc;
}

// -- Section 4.2 -- Terrain/height multiplier (Mz,cat) -----------------------

function getMzCat(regionKey, terrainCategory, z) {
  if (regionKey === "A0") {
    return { value: MZCAT_A0_CONSTANT, note: "Region A0: constant Mz,cat = 1.24 for z ≤ 200 m (Table 4.1, Note 1)" };
  }
  const ys = MZCAT_TABLE[terrainCategory];
  if (!ys) throw new Error("Unknown terrain category: " + terrainCategory);
  return { value: interpTable(z, MZCAT_HEIGHTS, ys) };
}

// -- Section 4.3 -- Shielding multiplier (Ms) ---------------------------------

function getMs(h, s) {
  if (h > 25) {
    return { value: 1.0, note: "Ms = 1.0 for h > 25 m (Clause 4.3.1)" };
  }
  if (s === null || s === undefined) return { value: 1.0, note: "No shielding assumed" };
  const clamped = Math.max(MS_TABLE.s[0], Math.min(MS_TABLE.s[MS_TABLE.s.length - 1], s));
  const value = interpTable(clamped, MS_TABLE.s, MS_TABLE.Ms);
  return { value, note: clamped !== s ? `s=${s} outside tabulated range 1.5-12.0, clamped to ${clamped}` : undefined };
}

// NOTE: Calculating the shielding parameter (s) from upwind building geometry
// (Equations 4.3(1)/4.3(2), Clause 4.3.3) is not implemented -- the equation did not
// extract reliably from the source PDF and a wrong formula could silently produce
// unconservative pressures. Enter "s" directly (Table 4.2), or leave shielding out
// (Ms = 1.0, the conservative default) and calculate s by hand from Clause 4.3.3 if needed.

// -- Section 4.4 -- Topographic multiplier (Mt) -------------------------------

// Hill-shape multiplier (Mh), Clause 4.4.2. Only implements the H/(2Lu) <= 0.45 case
// (Equation 4.4(3)) which covers the vast majority of real sites. For steeper upwind
// slopes (H/(2Lu) > 0.45) the Standard requires assessment of a "peak zone" from
// Figure 4.5 that is not reproduced here -- the calculator flags this and asks the
// user to complete that check manually against Clause 4.4.2(c).
function computeMh({ H, Lu, x, z, downwindType }) {
  if (!H || H < 10) {
    return { Mh: 1.0, note: "Mh = 1.0 (H < 10 m or no local topographic feature), Clause 4.4.2" };
  }
  const ratio = H / (2 * Lu);
  if (ratio < 0.05) {
    return { Mh: 1.0, ratio, note: "Mh = 1.0 (H/2Lu < 0.05), Clause 4.4.2(a)" };
  }
  const L1 = Math.max(0.36 * Lu, 0.4 * H);
  const L2 = x <= 0 ? 4 * L1 : downwindType === "escarpment" ? 10 * L1 : 4 * L1;
  const Mh = 1 + (H / (3.5 * (z + L1))) * (1 - x / L2);
  const result = { Mh, ratio, L1, L2 };
  if (ratio > 0.45) {
    result.warning =
      "H/(2Lu) > 0.45: upwind slope exceeds the Standard's simple case. Equation 4.4(3) has been used as an approximation " +
      "outside the peak zone -- check Clause 4.4.2(c) and Figure 4.5 manually for the peak-zone value near the crest.";
  }
  return result;
}

function computeMt({ regionKey, Mh, Mlee, elevationE, mode }) {
  // mode: 'A4_high' for A4/NZ1-4 sites > 500 m AMSL (Eq 4.4(1)); 'A0' for Region A0 (Eq 4.4(2)); else default (c)
  if (mode === "A0") {
    return { value: 0.5 + 0.5 * Mh, formula: "Mt = 0.5 + 0.5 Mh (Region A0, Eq 4.4(2))" };
  }
  if (mode === "A4_high") {
    const value = Mh * Mlee * (1 + 0.00015 * elevationE);
    return { value, formula: "Mt = Mh Mlee (1 + 0.00015E) (Eq 4.4(1))" };
  }
  return { value: Math.max(Mh, Mlee), formula: "Mt = max(Mh, Mlee) (Clause 4.4.1(c))" };
}

// -- Section 2 -- Site wind speed & design wind speed -------------------------

function computeSiteWindSpeeds({ regionKey, R, terrainCategory, z, h, s, Mt }) {
  const vr = getVR(regionKey, R);
  const mc = getMc(regionKey);
  const mzcat = getMzCat(regionKey, terrainCategory, z);
  const ms = getMs(h, s);

  const perDirection = CARDINALS.map((c, i) => {
    const md = getMd(regionKey, c);
    const vsit = vr.value * mc * md * (mzcat.value * ms.value * Mt);
    return { cardinal: c, angle: CARDINAL_ANGLES[c], Md: md, Vsit: vsit };
  });

  return { vr, mc, mzcat, ms, perDirection };
}

// Clause 2.3: Vdes,theta = max Vsit,beta linearly interpolated between cardinal
// points, within a sector +-45 deg of the orthogonal direction theta.
function vsitAtAngle(perDirection, angle) {
  const a = ((angle % 360) + 360) % 360;
  // find bounding cardinals
  let lo = null;
  let hi = null;
  for (let i = 0; i < perDirection.length; i++) {
    const cur = perDirection[i];
    const next = perDirection[(i + 1) % perDirection.length];
    let curA = cur.angle;
    let nextA = next.angle === 0 ? 360 : next.angle;
    if (a >= curA && a <= nextA) {
      lo = cur;
      hi = next;
      return lerp(a, curA, nextA, cur.Vsit, next.Vsit);
    }
  }
  return perDirection[0].Vsit;
}

function computeDesignWindSpeed(perDirection, theta) {
  const lowBound = theta - 45;
  const highBound = theta + 45;
  const candidates = [vsitAtAngle(perDirection, lowBound), vsitAtAngle(perDirection, highBound)];
  perDirection.forEach((d) => {
    const diff = angleDiff(d.angle, theta);
    if (diff >= -45 && diff <= 45) candidates.push(d.Vsit);
  });
  return Math.max(...candidates);
}

function computeDesignWindSpeeds(perDirection, buildingAzimuth) {
  const axes = [0, 90, 180, 270].map((a) => (a + buildingAzimuth) % 360);
  const labels = ["θ=0° (front)", "θ=90°", "θ=180°", "θ=270°"];
  return axes.map((theta, i) => ({
    label: labels[i],
    theta,
    Vdes: computeDesignWindSpeed(perDirection, theta),
  }));
}

// -- Section 2.4 -- Design wind pressure --------------------------------------

// p (Pa) = 0.5 * rho_air * Vdes^2 * Cshp * Cdyn   (Equation 2.4(1))
function windPressure(Vdes, Cshp, Cdyn) {
  return 0.5 * AIR_DENSITY * Vdes * Vdes * Cshp * Cdyn;
}

// -- Section 5.4 -- External pressure coefficients, walls --------------------

function cpeWindwardWall(h) {
  return h > 25 ? 0.8 : 0.7; // Table 5.2(A), z=h case for h<=25m
}

function cpeLeewardWall({ theta, pitch, db, roofType }) {
  // Table 5.2(B), Note 3: for hip roofs use the theta=0 values even when wind is at theta=90.
  // So the theta=90 (gable) row is only used for gable / monoslope roofs.
  if (theta === 90 && roofType !== "hip") {
    return interpTable(db, CPE_LEEWARD_THETA90.db, CPE_LEEWARD_THETA90.cpe);
  }
  if (pitch < 10) {
    return interpTable(db, CPE_LEEWARD_THETA0_LOWPITCH.db, CPE_LEEWARD_THETA0_LOWPITCH.cpe);
  }
  if (pitch <= 20) {
    // 10, 15, 20 deg values are independent of d/b -- nearest tabulated pitch (10/15/20)
    const pitches = [10, 15, 20];
    const nearest = pitches.reduce((a, b) => (Math.abs(b - pitch) < Math.abs(a - pitch) ? b : a));
    return CPE_LEEWARD_THETA0_BY_PITCH[nearest];
  }
  // pitch >= 25
  return interpTable(db, CPE_LEEWARD_THETA0_PITCH25.db, CPE_LEEWARD_THETA0_PITCH25.cpe);
}

function cpeSideWallZones() {
  return CPE_SIDEWALL_ZONES;
}

function cpeRoofLowPitch(hd) {
  const clampedHd = Math.max(0.5, Math.min(1.0, hd));
  return CPE_ROOF_LOWPITCH.zones.map((zone) => {
    const v05 = zone.values[0.5];
    const v10 = zone.values[1.0];
    if (v10 === null) {
      return { ...zone, values: v05, note: "AS/NZS 1170.2 does not tabulate h/d=1.0 for this zone — showing h/d=0.5 value; refer to Table 5.3(A) for h/d>0.5" };
    }
    const lowVal = lerp(clampedHd, 0.5, 1.0, v05[0], v10[0]);
    const highVal = lerp(clampedHd, 0.5, 1.0, v05[1], v10[1]);
    return { ...zone, values: [round2(lowVal), round2(highVal)] };
  });
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

// Table 5.3(B) -- roof Cp,e, upwind (windward) slope, pitch >= 10 deg. Returns [more-neg, less-neg].
// 2D lookup: interpolate along pitch within each tabulated h/d row, then interpolate those results
// along h/d. Table 5.3 notes say interpolate h/d linearly; pitch interpolation follows the same
// convention used elsewhere in Section 5 for intermediate angles.
function cpeRoofUpwindPitched(hd, pitch) {
  const T = CPE_ROOF_UPWIND_PITCHED;
  if (pitch >= 45) {
    return [0.0, round2(0.8 * Math.sin((45 * Math.PI) / 180))];
  }
  const clampedPitch = Math.max(T.pitch[0], Math.min(T.pitch[T.pitch.length - 1], pitch));
  const rowResults = T.rows.map((row) => [
    interpTable(clampedPitch, T.pitch, row.map((v) => v[0])),
    interpTable(clampedPitch, T.pitch, row.map((v) => v[1])),
  ]);
  const moreNeg = interpTable(hd, T.hd, rowResults.map((r) => r[0]));
  const lessNeg = interpTable(hd, T.hd, rowResults.map((r) => r[1]));
  return [round2(moreNeg), round2(lessNeg)];
}

// Table 5.3(C) -- roof Cp,e, downwind slope (D) / hip-end crosswind slope (R), pitch >= 10 deg.
// A single (always-negative) value. For pitch >= 25 deg the Standard gives a b/d-based formula
// instead of a pitch-dependent table (b = building width, d = depth, both in the current wind
// direction -- i.e. b/d is the reciprocal of the d/b used for the leeward wall).
function cpeRoofDownwindPitched(hd, pitch, bOverD) {
  if (pitch >= 25) {
    if (bOverD <= 3) return -0.6;
    if (bOverD >= 8) return -0.9;
    return round2(-0.06 * (7 + bOverD));
  }
  const T = CPE_ROOF_DOWNWIND_PITCHED;
  const clampedPitch = Math.max(T.pitch[0], Math.min(T.pitch[T.pitch.length - 1], pitch));
  const rowResults = T.rows.map((row) => interpTable(clampedPitch, T.pitch, row));
  return round2(interpTable(hd, T.hd, rowResults));
}

// -- Appendix B, Clause B.3 -- net pressure coefficients for free roofs (open buildings) ----------

// A table cell is [a] or [a, b]. Split into its negative and positive load-case components.
function splitCell(cell) {
  const out = { neg: null, pos: null };
  cell.forEach((v) => {
    if (v < 0 && (out.neg === null || v < out.neg)) out.neg = v;
    else if (v >= 0 && (out.pos === null || v > out.pos)) out.pos = v;
  });
  return out;
}

function cellToValues(c) {
  const vals = [];
  if (c.neg !== null) vals.push(round2(c.neg));
  if (c.pos !== null) vals.push(round2(c.pos));
  return vals;
}

// Clause B.3.1: interpolate only between values of the same sign; where no value of that sign
// exists on one side, 0.0 is assumed for interpolation purposes.
function lerpCells(c0, c1, t) {
  if (t <= 0) return c0;
  if (t >= 1) return c1;
  const mix = (a, b) => {
    if (a === null && b === null) return null;
    return (a === null ? 0 : a) + t * ((b === null ? 0 : b) - (a === null ? 0 : a));
  };
  return { neg: mix(c0.neg, c1.neg), pos: mix(c0.pos, c1.pos) };
}

function interpCellsOnAxis(xs, cells, x) {
  if (x <= xs[0]) return cells[0];
  if (x >= xs[xs.length - 1]) return cells[cells.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) return lerpCells(cells[i], cells[i + 1], (x - xs[i]) / (xs[i + 1] - xs[i]));
  }
  return cells[cells.length - 1];
}

// blockedPct: % of the cross-section exposed to the wind blocked under the roof. <=50% is "empty
// under", >=75% is "blocked under"; linear in between.
function blockageFraction(blockedPct) {
  return Math.max(0, Math.min(1, (blockedPct - 50) / 25));
}

function freeRoofCell(pitches, emptyCells, blockedCells, pitch, blockedPct) {
  const e = interpCellsOnAxis(pitches, emptyCells.map(splitCell), pitch);
  const b = interpCellsOnAxis(pitches, blockedCells.map(splitCell), pitch);
  return cellToValues(lerpCells(e, b, blockageFraction(blockedPct)));
}

// Returns the free-roof load cases for one wind direction.
//   roofType: "monoslope" | "gable" (= pitched) | "troughed"   (hip has no free-roof table)
//   theta: 0 (wind up the slope / normal to ridge), 180 (down the slope), 90 (parallel to ridge)
//   hd: roof height / along-wind depth
// -> { mode: "halves"|"zones", entries:[{label, values:[...]}], notes:[...], unavailable?:string }
function freeRoofCases({ roofType, pitch, theta, hd, blockedPct }) {
  const notes = [];
  if (roofType === "hip") {
    return { unavailable: "A hip roof has no free-roof table in Appendix B -- source Cp,n from the Standard (or treat it as a pitched roof) directly." };
  }
  if (hd < 0.05) {
    notes.push(`h/d = ${round2(hd)} is below the 0.05 lower limit of Tables B.4(B) -- values for h/d = 0.05 shown; confirm against the Standard.`);
  } else if (hd > 1) {
    notes.push(`h/d = ${round2(hd)} is above the 1.0 upper limit of Tables B.4(A)/B.5/B.6 -- values for h/d = 1.0 shown; confirm against the Standard.`);
  }

  const M = FREE_ROOF_MONOSLOPE_A;
  const monoCell = (key, th, p) => freeRoofCell(M.pitch, M[th][key.e], M[th][key.b], p, blockedPct);
  const wKey = { e: "wEmpty", b: "wBlocked" };
  const lKey = { e: "lEmpty", b: "lBlocked" };

  // Low h/d (0.05 <= h/d < 0.25): Table B.4(B), zones by distance from the windward edge.
  if (hd < 0.25) {
    const w0 = monoCell(wKey, "theta0", 0);
    const l0 = monoCell(lKey, "theta0", 0);
    const far = lerpCells(
      splitCell(FREE_ROOF_MONOSLOPE_B_FAR.empty),
      splitCell(FREE_ROOF_MONOSLOPE_B_FAR.blocked),
      blockageFraction(blockedPct)
    );
    notes.push("Table B.4(B) (0.05 <= h/d < 0.25) applies for any roof pitch and wind direction -- Cp,n is given by distance x from the windward edge.");
    return {
      mode: "zones",
      entries: [
        { label: "0 to 1h from windward edge (Cp,w, Table B.4(A) at 0°)", values: w0 },
        { label: "1h to 2h from windward edge (Cp,l, Table B.4(A) at 0°)", values: l0 },
        { label: "> 2h from windward edge", values: cellToValues(far) },
      ],
      notes,
    };
  }

  // Wind parallel to the ridge: pitch is effectively zero -> Table B.4(A) at pitch 0 (Clause B.3.1).
  if (theta === 90) {
    notes.push("Wind parallel to the ridge: roof pitch is effectively zero, so Table B.4(A) at 0° is used (Clause B.3.1).");
    return {
      mode: "halves",
      entries: [
        { label: "Windward half (Cp,w)", values: monoCell(wKey, "theta0", 0) },
        { label: "Leeward half (Cp,l)", values: monoCell(lKey, "theta0", 0) },
      ],
      notes,
    };
  }

  if (roofType === "monoslope") {
    if (pitch > M.pitch[M.pitch.length - 1]) notes.push(`Pitch ${pitch}° exceeds the 30° tabulated limit of Table B.4(A) -- values for 30° shown.`);
    const th = theta === 180 ? "theta180" : "theta0";
    return {
      mode: "halves",
      entries: [
        { label: "Windward half (Cp,w)", values: monoCell(wKey, th, pitch) },
        { label: "Leeward half (Cp,l)", values: monoCell(lKey, th, pitch) },
      ],
      notes,
    };
  }

  const T = roofType === "troughed" ? FREE_ROOF_TROUGHED : FREE_ROOF_PITCHED;
  const tName = roofType === "troughed" ? "B.6" : "B.5";
  const lo = T.pitch[0];
  const hi = T.pitch[T.pitch.length - 1];
  if (pitch < lo || pitch > hi) {
    notes.push(`Pitch ${pitch}° is outside the ${lo}°–${hi}° range of Table ${tName} -- the nearest tabulated pitch is shown; confirm against the Standard.`);
  }
  return {
    mode: "halves",
    entries: [
      { label: "Windward half (Cp,w)", values: freeRoofCell(T.pitch, T.wEmpty, T.wBlocked, pitch, blockedPct) },
      { label: "Leeward half (Cp,l)", values: freeRoofCell(T.pitch, T.lEmpty, T.lBlocked, pitch, blockedPct) },
    ],
    notes,
  };
}
