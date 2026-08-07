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

function cpeLeewardWall({ theta, pitch, db }) {
  if (theta === 90) {
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
