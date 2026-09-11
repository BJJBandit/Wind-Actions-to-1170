/*
 * UI wiring for the AS/NZS 1170.2:2021 basic wind actions calculator.
 * All engineering calculations live in calc.js / data.js -- this file only
 * reads form inputs, calls those functions, and renders the results.
 */

function $(id) {
  return document.getElementById(id);
}

function fmt(x, dp = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return "&mdash;";
  return x.toFixed(dp);
}

function cpeSpan(v) {
  const cls = v >= 0 ? "val-pos" : "val-neg";
  return `<span class="${cls}">${v >= 0 ? "+" : ""}${v.toFixed(2)}</span>`;
}

// ---------------------------------------------------------------------------
// Populate static form controls
// ---------------------------------------------------------------------------

function populateRegions() {
  const sel = $("region");
  const groups = { AU: "Australia", NZ: "New Zealand" };
  Object.entries(groups).forEach(([country, label]) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    Object.entries(REGIONS)
      .filter(([, r]) => r.country === country)
      .forEach(([key, r]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = `${key} – ${r.label}`;
        optgroup.appendChild(opt);
      });
    sel.appendChild(optgroup);
  });
  sel.value = "A2";
}

function populateLocations() {
  const sel = $("siteLocation");
  const groups = { AU: "Australia", NZ: "New Zealand" };
  const byCountry = { AU: [], NZ: [] };
  LOCATIONS.forEach((loc) => {
    const country = loc.name.trim().endsWith("NZ") ? "NZ" : "AU";
    byCountry[country].push(loc);
  });

  Object.entries(groups).forEach(([country, label]) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    byCountry[country].forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc.name;
      opt.textContent = `${loc.name}${loc.confidence === "medium" ? " *" : ""}`;
      optgroup.appendChild(opt);
    });
    sel.appendChild(optgroup);
  });

  sel.addEventListener("change", () => {
    const loc = LOCATIONS.find((l) => l.name === sel.value);
    const noteEl = $("locationNote");
    if (!loc) {
      noteEl.innerHTML = "";
      return;
    }
    $("region").value = loc.region;
    $("region").dispatchEvent(new Event("change"));
    const cls = loc.confidence === "high" ? "note" : "warning";
    const lead = loc.confidence === "high" ? "Region auto-filled." : "Region auto-filled (medium confidence — please verify).";
    noteEl.innerHTML = `<div class="${cls}"><strong>${lead}</strong> ${loc.note} Region set to <strong>${loc.region}</strong> — you can override it in the Region dropdown above.</div>`;
  });
}

function populateAzimuth() {
  const sel = $("azimuth");
  for (let a = 0; a < 360; a += 5) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = `${a}°`;
    sel.appendChild(opt);
  }
  sel.value = "0";
}

function populateBuildingTypes() {
  const sel = $("buildingType");
  BUILDING_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.label} (${t.clause})`;
    sel.appendChild(opt);
  });

  function refresh() {
    const type = BUILDING_TYPES.find((t) => t.id === sel.value);
    const gate = $("buildingTypeGate");
    const note = $("buildingTypeNote");
    const calcBtn = $("calcPressure");

    if (!type || type.supported) {
      gate.hidden = true;
      note.innerHTML = "";
      calcBtn.disabled = false;
      calcBtn.title = "";
      return;
    }

    const msg = `This calculator's Section&nbsp;3 (design wind pressure) only covers enclosed rectangular buildings (Section&nbsp;5).
      <strong>${type.label}</strong> is covered by <strong>${type.clause}</strong> of AS/NZS&nbsp;1170.2:2021, which this tool does not
      calculate &mdash; refer to that Appendix directly. Section&nbsp;2 (site &amp; design wind speed) is unaffected and the V<sub>des,θ</sub>
      values calculated there still apply as the input to ${type.clause}'s own aerodynamic shape factor.`;
    gate.innerHTML = msg;
    gate.hidden = false;
    note.innerHTML = `<div class="note">Building type set to <strong>${type.label}</strong> (${type.clause}) &mdash; recorded for reference only.</div>`;
    calcBtn.disabled = true;
    calcBtn.title = `Not calculated for ${type.label} -- see the notice in Section 3`;
  }

  sel.addEventListener("change", refresh);
  refresh();
}

function populateImportanceLevels() {
  const sel = $("importanceLevel");
  IMPORTANCE_LEVELS.forEach((il) => {
    const opt = document.createElement("option");
    opt.value = il.id;
    opt.textContent = il.label;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", () => {
    const il = IMPORTANCE_LEVELS.find((x) => x.id === sel.value);
    const note = $("importanceLevelNote");
    if (!il) {
      note.innerHTML = "";
      return;
    }
    $("ari").value = String(il.ariUls);
    $("ari").dispatchEvent(new Event("change"));
    note.innerHTML = `<div class="warning">Set R&nbsp;=&nbsp;${il.ariUls}&nbsp;years below, the commonly-published ULS default for
      ${il.id} at a 50-year design working life (AS/NZS&nbsp;1170.0 / NCC lineage) &mdash; not read from a specific NCC edition in this
      session. Confirm the importance level classification and the exact R value against the current NCC and AS/NZS&nbsp;1170.0 for this
      building, especially if the design working life isn't 50 years. Serviceability limit state design uses a separate, shorter R
      (commonly 20&ndash;25 years) not set by this selector.</div>`;
  });
}

function populateBuildingSizes() {
  const sel = $("buildingSize");
  BUILDING_SIZES.forEach((size) => {
    const opt = document.createElement("option");
    opt.value = size.name;
    opt.textContent = size.name;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", () => {
    const size = BUILDING_SIZES.find((s) => s.name === sel.value);
    if (!size) return; // "custom / enter below" -- leave existing W/L untouched
    $("bldB").value = size.w;
    $("bldD").value = size.l;
    $("bldB").dispatchEvent(new Event("input"));
    $("bldD").dispatchEvent(new Event("input"));
  });
}

function populateRoofTypes() {
  const sel = $("roofType");
  ROOF_TYPES.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.label;
    sel.appendChild(opt);
  });
  sel.value = "gable";
}

function populateAri() {
  const sel = $("ari");
  VR_STANDARD_R.forEach((R) => {
    const opt = document.createElement("option");
    opt.value = R;
    opt.textContent = `R = ${R} years`;
    sel.appendChild(opt);
  });
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom R (≥5 years)";
  sel.appendChild(custom);
  sel.value = "500";

  sel.addEventListener("change", () => {
    $("ari-custom-wrap").hidden = sel.value !== "custom";
  });
}

function populateCpiCases() {
  const sel = $("cpiCase");
  CPI_CASES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
}

function wireTopographyControls() {
  const mode = $("mtMode");
  const manualWrap = $("mtManualWrap");
  const hillInputs = $("mhInputs");
  const region = $("region");
  const a0check = $("mhA0");
  const elevWrap = $("mhElevWrap");

  function refresh() {
    manualWrap.hidden = mode.value !== "manual";
    hillInputs.hidden = mode.value !== "hill";
    const regionIsA4orNZ = ["A4", "NZ1", "NZ2", "NZ3", "NZ4"].includes(region.value);
    elevWrap.hidden = !(mode.value === "hill" && regionIsA4orNZ);
    a0check.checked = region.value === "A0";
  }
  mode.addEventListener("change", refresh);
  region.addEventListener("change", refresh);
  refresh();
}

// ---------------------------------------------------------------------------
// Section A: site & design wind speed
// ---------------------------------------------------------------------------

function readAriYears() {
  const sel = $("ari");
  if (sel.value === "custom") {
    return Math.max(5, parseFloat($("ariCustom").value) || 5);
  }
  return parseFloat(sel.value);
}

function computeMtFromForm(regionKey) {
  const mode = $("mtMode").value;
  if (mode === "flat") return { value: 1.0, formula: "Mₜ = 1.0 (no local topographic feature)" };
  if (mode === "manual") return { value: parseFloat($("mtManual").value) || 1.0, formula: "Manual entry" };

  // mode === 'hill'
  const H = parseFloat($("mhH").value) || 0;
  const Lu = parseFloat($("mhLu").value) || 1;
  const x = parseFloat($("mhX").value) || 0;
  const z = parseFloat($("bldH").value) || 0;
  const downwindType = $("mhType").value;
  const mh = computeMh({ H, Lu, x, z, downwindType });

  const regionIsA4orNZ = ["A4", "NZ1", "NZ2", "NZ3", "NZ4"].includes(regionKey);
  const elevation = parseFloat($("mhElev").value) || 0;
  let mtMode = "default";
  if (regionKey === "A0") mtMode = "A0";
  else if (regionIsA4orNZ && elevation > 500) mtMode = "A4_high";

  const mt = computeMt({ regionKey, Mh: mh.Mh, Mlee: 1.0, elevationE: elevation, mode: mtMode });
  return { ...mt, mh };
}

const WINDROSE_CENTER = 120;
const WINDROSE_MAX_R = 80;
const WINDROSE_MIN_R = 20;
const WINDROSE_LABEL_GAP = 15;

// Builds a small radar-style diagram: one spoke per cardinal direction, length
// proportional to that direction's Vsit,beta (floored so low values stay legible,
// not scaled from a true zero -- the numeric label at each vertex is the exact
// value; the shape is a supporting "at a glance" view of directionality only.
function buildWindRoseSvg(perDirection) {
  const maxVsit = Math.max(...perDirection.map((d) => d.Vsit));
  const maxIndex = perDirection.reduce((best, d, i, arr) => (d.Vsit > arr[best].Vsit ? i : best), 0);

  const points = perDirection.map((d, i) => {
    const r = maxVsit > 0 ? WINDROSE_MIN_R + (d.Vsit / maxVsit) * (WINDROSE_MAX_R - WINDROSE_MIN_R) : WINDROSE_MIN_R;
    const rad = (d.angle * Math.PI) / 180;
    const x = WINDROSE_CENTER + r * Math.sin(rad);
    const y = WINDROSE_CENTER - r * Math.cos(rad);
    return { ...d, x, y, r, isMax: i === maxIndex };
  });

  const polygonPoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const dots = points
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.isMax ? 5 : 3.5}" class="${p.isMax ? "windrose-dot-max" : "windrose-dot"}" />`)
    .join("");

  const labels = points
    .map((p) => {
      const labelR = p.r + WINDROSE_LABEL_GAP;
      const rad = (p.angle * Math.PI) / 180;
      const lx = WINDROSE_CENTER + labelR * Math.sin(rad);
      const ly = WINDROSE_CENTER - labelR * Math.cos(rad);
      return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="${p.isMax ? "windrose-label-max" : "windrose-label"}">${fmt(p.Vsit, 1)}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 240 240" width="220" height="220" role="img" aria-label="Site wind speed by cardinal direction">
      <circle cx="120" cy="120" r="102" class="compass-ring" />
      <g class="compass-ticks">
        <line x1="120" y1="18" x2="120" y2="30" />
        <line x1="222" y1="120" x2="210" y2="120" />
        <line x1="120" y1="222" x2="120" y2="210" />
        <line x1="18" y1="120" x2="30" y2="120" />
      </g>
      <g class="compass-labels">
        <text x="120" y="14" text-anchor="middle">N</text>
        <text x="230" y="125" text-anchor="middle">E</text>
        <text x="120" y="236" text-anchor="middle">S</text>
        <text x="10" y="125" text-anchor="middle">W</text>
      </g>
      <polygon points="${polygonPoints}" class="windrose-polygon" />
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderSpeedResults(data) {
  const { region, R, terrainCategory, z, siteResult, designResults, mt } = data;
  const el = $("speedResults");
  el.hidden = false;

  const multRow = `
    <div class="pill">V<sub>R</sub> = ${fmt(siteResult.vr.value, 1)} m/s <span class="hint">(${siteResult.vr.source})</span></div>
    <div class="pill">M<sub>c</sub> = ${fmt(siteResult.mc, 3)}</div>
    <div class="pill">M<sub>z,cat</sub> = ${fmt(siteResult.mzcat.value, 3)}</div>
    <div class="pill">M<sub>s</sub> = ${fmt(siteResult.ms.value, 3)}</div>
    <div class="pill">M<sub>t</sub> = ${fmt(mt.value, 3)}</div>
  `;

  const dirRows = siteResult.perDirection
    .map((d) => `<tr><td>${d.cardinal}</td><td class="num">${d.angle}°</td><td class="num">${fmt(d.Md, 2)}</td><td class="num">${fmt(d.Vsit, 1)}</td></tr>`)
    .join("");

  const desRows = designResults
    .map((d) => {
      const flag = d.Vdes < 30 ? ' <span class="hint">(&lt; 30 m/s ULS minimum, Cl 2.3)</span>' : "";
      return `<tr><td>${d.label}</td><td class="num">${d.theta}°</td><td class="num">${fmt(d.Vdes, 1)}${flag}</td></tr>`;
    })
    .join("");

  let warnings = "";
  if (siteResult.vr.warning) warnings += `<div class="warning">${siteResult.vr.source}</div>`;
  if (mt.mh && mt.mh.warning) warnings += `<div class="warning">${mt.mh.warning}</div>`;

  el.innerHTML = `
    <h3>Multipliers used</h3>
    <div>${multRow}</div>
    ${warnings}
    <h3>Wind speed by direction</h3>
    <div class="windrose-wrap">
      ${buildWindRoseSvg(siteResult.perDirection)}
      <p class="hint">Spoke length shows relative V<sub>sit,β</sub> magnitude across directions (floored, not to scale from zero) &mdash;
        the number at each vertex is the exact value; the highlighted vertex is the governing (maximum) direction.</p>
    </div>
    <h3>Site wind speed, V<sub>sit,β</sub> <span class="ref">(Equation 2.2)</span></h3>
    <table>
      <thead><tr><th>Direction</th><th class="num">Bearing</th><th class="num">M<sub>d</sub></th><th class="num">V<sub>sit,β</sub> (m/s)</th></tr></thead>
      <tbody>${dirRows}</tbody>
    </table>
    <h3>Design wind speed, V<sub>des,θ</sub> <span class="ref">(Clause 2.3, building axes)</span></h3>
    <table>
      <thead><tr><th>Orthogonal axis</th><th class="num">Bearing</th><th class="num">V<sub>des,θ</sub> (m/s)</th></tr></thead>
      <tbody>${desRows}</tbody>
    </table>
    <p class="note">The governing V<sub>des,θ</sub> value has been copied into Section&nbsp;3 below to calculate design wind pressures.</p>
  `;

  // auto-fill pressure section with the governing (max) Vdes
  const maxVdes = Math.max(...designResults.map((d) => d.Vdes));
  $("pVdes").value = maxVdes.toFixed(1);
}

function runSpeedCalc() {
  const regionKey = $("region").value;
  const R = readAriYears();
  const terrainCategory = parseFloat($("terrainCategory").value);
  const z = parseFloat($("bldH").value) || 0;
  const h = z; // building height (Building section) used consistently as average roof height for Ms applicability
  const sRaw = $("shieldingS").value;
  const s = sRaw === "" ? null : parseFloat(sRaw);
  const azimuth = parseFloat($("azimuth").value) || 0;

  const mt = computeMtFromForm(regionKey);
  const siteResult = computeSiteWindSpeeds({ regionKey, R, terrainCategory, z, h, s, Mt: mt.value });
  const designResults = computeDesignWindSpeeds(siteResult.perDirection, azimuth);

  renderSpeedResults({ region: regionKey, R, terrainCategory, z, siteResult, designResults, mt });
}

// ---------------------------------------------------------------------------
// Section B: design wind pressure
// ---------------------------------------------------------------------------

function renderPressureResults() {
  const type = BUILDING_TYPES.find((t) => t.id === $("buildingType").value);
  if (type && !type.supported) return; // defence-in-depth -- the button is disabled for this case

  const Vdes = parseFloat($("pVdes").value) || 0;
  const Cdyn = parseFloat($("pCdyn").value) || 1.0;
  const b = parseFloat($("bldB").value) || 1;
  const d = parseFloat($("bldD").value) || 1;
  const h = parseFloat($("bldH").value) || 1;
  const pitch = parseFloat($("roofPitch").value) || 0;
  const theta = parseInt($("windTheta").value, 10);
  const roofType = $("roofType").value || "gable";
  const db = d / b;
  const hd = h / d;

  const cpiCase = CPI_CASES.find((c) => c.id === $("cpiCase").value);
  const cpeWw = cpeWindwardWall(h);
  const cpeLw = cpeLeewardWall({ theta, pitch, db, roofType });
  // For a hip roof, Table 5.2(B) Note 3 sends the leeward wall to the theta=0 branch even at theta=90.
  const leewardUsesTheta0 = theta === 0 || roofType === "hip";
  const leewardTableMinDb = !leewardUsesTheta0 || pitch < 10 ? 1 : pitch >= 25 ? 0.1 : null;
  const leewardTableMaxDb = !leewardUsesTheta0 || pitch < 10 ? 4 : pitch >= 25 ? 0.3 : null;
  const dbOutOfRange = leewardTableMinDb !== null && (db < leewardTableMinDb || db > leewardTableMaxDb);

  let cpiValues;
  let cpiLabel;
  if (cpiCase.cpi === "cpe_ww") {
    cpiValues = [cpeWw];
    cpiLabel = "= Cp,e (windward wall)";
  } else {
    cpiValues = cpiCase.cpi;
    cpiLabel = cpiValues.map((v) => v.toFixed(2)).join(" or ");
  }

  function netRows(surfaceLabel, cpeValues) {
    return cpeValues.flatMap((cpe) =>
      cpiValues.map((cpi) => {
        const cshpExt = cpe; // Ka=Kc=Kl=Kp=1
        const netCshp = cshpExt - cpi;
        const pExt = windPressure(Vdes, cpe, Cdyn) / 1000;
        const pInt = windPressure(Vdes, cpi, Cdyn) / 1000;
        const pNet = windPressure(Vdes, netCshp, Cdyn) / 1000;
        return { surfaceLabel, cpe, cpi, pExt, pInt, pNet };
      })
    );
  }

  const wallRows = [
    ...netRows("Windward wall", [cpeWw]),
    ...netRows("Leeward wall", [cpeLw]),
    ...cpeSideWallZones().flatMap((z) => netRows(`Side wall, ${z.label}`, [z.cpe])),
  ];

  const roofZones = pitch < 10 ? cpeRoofLowPitch(hd) : null;
  const roofRows = roofZones
    ? roofZones.flatMap((z) => netRows(`Roof, ${z.label}`, Array.isArray(z.values) ? z.values : []).map((r) => ({ ...r, note: z.note })))
    : [];

  function rowsToHtml(rows) {
    return rows
      .map(
        (r) => `<tr>
          <td>${r.surfaceLabel}</td>
          <td class="num">${cpeSpan(r.cpe)}</td>
          <td class="num">${cpeSpan(r.cpi)}</td>
          <td class="num">${fmt(r.pExt, 2)}</td>
          <td class="num">${fmt(r.pInt, 2)}</td>
          <td class="num">${fmt(r.pNet, 2)}</td>
        </tr>${r.note ? `<tr><td colspan="6" class="note">${r.note}</td></tr>` : ""}`
      )
      .join("");
  }

  const el = $("pressureResults");
  el.hidden = false;

  let dbNote = "";
  if (dbOutOfRange) {
    dbNote = `<div class="warning">d/b = ${fmt(db, 2)} is outside the tabulated range (${leewardTableMinDb}&ndash;${leewardTableMaxDb})
      for the leeward wall C<sub>p,e</sub> lookup (Table 5.2(B)) &mdash; the nearest tabulated boundary value has been used.
      Check Table 5.2(B) directly if this ratio is far outside the tabulated range.</div>`;
  }

  let pitchNote = "";
  if (pitch >= 10) {
    pitchNote = `<div class="warning">Roof pitch ≥ 10°: automatic C<sub>p,e</sub> lookup is not implemented for this range
      (Tables 5.3(B)/(C)). Source a C<sub>p,e</sub> value from AS/NZS 1170.2 directly and compute
      p = 0.5 &times; 1.2 &times; V<sub>des,θ</sub>&sup2; &times; C<sub>p,e</sub> &times; C<sub>dyn</sub> manually.</div>`;
  }

  let roofTypeNote = "";
  if (roofType === "hip") {
    roofTypeNote = `<div class="note"><strong>Hip roof:</strong> the leeward wall C<sub>p,e</sub> uses the θ&nbsp;=&nbsp;0° values at
      every wind direction (Table 5.2(B), Note 3). For pitch ≥ 10°, the hip-end (R) roof slopes are covered by
      Table 5.3(C), which is not calculated here.</div>`;
  } else if (roofType === "monoslope") {
    roofTypeNote = `<div class="note"><strong>Monoslope / skillion roof:</strong> there is no ridge &mdash; "θ = 0°" means wind up or
      down the slope and "θ = 90°" means wind across it. For pitch &lt; 10° the roof C<sub>p,e</sub> values from Table 5.3(A) shown
      below apply to the single slope; Table 5.2(B) does not tabulate a monoslope leeward wall, so the gable value is used as an
      approximation &mdash; confirm against the Standard.</div>`;
  }

  el.innerHTML = `
    <div class="pill">d/b = ${fmt(db, 2)}</div>
    <div class="pill">h/d = ${fmt(hd, 2)}</div>
    <div class="pill">Roof: ${ROOF_TYPES.find((r) => r.id === roofType)?.label || roofType}</div>
    <div class="pill">C<sub>p,i</sub> case: ${cpiLabel}</div>
    ${dbNote}
    ${pitchNote}
    ${roofTypeNote}
    <h3>Wall pressures <span class="ref">(Tables 5.2(A)&ndash;(C))</span></h3>
    <table>
      <thead><tr><th>Surface</th><th class="num">C<sub>p,e</sub></th><th class="num">C<sub>p,i</sub></th>
        <th class="num">p<sub>ext</sub> (kPa)</th><th class="num">p<sub>int</sub> (kPa)</th><th class="num">p<sub>net</sub> (kPa)</th></tr></thead>
      <tbody>${rowsToHtml(wallRows)}</tbody>
    </table>
    ${
      roofRows.length
        ? `<h3>Roof pressures, pitch &lt;10° <span class="ref">(Table 5.3(A))</span></h3>
    <table>
      <thead><tr><th>Zone</th><th class="num">C<sub>p,e</sub></th><th class="num">C<sub>p,i</sub></th>
        <th class="num">p<sub>ext</sub> (kPa)</th><th class="num">p<sub>int</sub> (kPa)</th><th class="num">p<sub>net</sub> (kPa)</th></tr></thead>
      <tbody>${rowsToHtml(roofRows)}</tbody>
    </table>`
        : ""
    }
    <p class="note">p = 0.5 &times; ρ<sub>air</sub>(1.2 kg/m&sup3;) &times; V<sub>des,θ</sub>&sup2; &times; C<sub>shp</sub> &times; C<sub>dyn</sub>
      (Equation 2.4(1)). Positive = pressure toward the surface, negative = suction. K<sub>a</sub>=K<sub>c</sub>=K<sub>l</sub>=K<sub>p</sub>=1.0 assumed.</p>
  `;
}

// ---------------------------------------------------------------------------
// Compass diagram (Section 1) -- rotates a building footprint to the chosen
// azimuth and allows dragging it directly to set that azimuth.
// ---------------------------------------------------------------------------

const COMPASS_CX = 210;
const COMPASS_CY = 190;
const COMPASS_MAX_HALF_SPAN = 46; // leaves room between the glyph and the axis lines (radius 88) for dimensioning
const COMPASS_AXIS_R = 88; // half-length of the theta=0/90 axis lines
const COMPASS_ARC_MIN_R = 40;
const COMPASS_ARC_MAX_R = 78;

// (x, y) at `radius` from the compass centre, at `angleDeg` measured clockwise from
// local "up" (0 deg) -- the same bearing convention used for true North elsewhere.
function compassPoint(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: COMPASS_CX + radius * Math.sin(rad), y: COMPASS_CY - radius * Math.cos(rad) };
}

// Neither the `.hidden` IDL property nor the `[hidden]` UA stylesheet rule can be relied on for
// SVG elements across browsers (some render a `hidden`-attributed SVG shape anyway) -- set the
// inline `display` style directly, which every SVG renderer honours unambiguously.
function setHidden(el, hide) {
  el.style.display = hide ? "none" : "";
}

function setLine(el, p1, p2) {
  el.setAttribute("x1", p1.x.toFixed(1));
  el.setAttribute("y1", p1.y.toFixed(1));
  el.setAttribute("x2", p2.x.toFixed(1));
  el.setAttribute("y2", p2.y.toFixed(1));
}

// Places a label at (angleDeg, radius) in the rotating (building-axis) frame, then
// counter-rotates it by -azimuth about its own position so it always reads upright.
function placeRotatingLabel(el, angleDeg, radius, azimuth) {
  const p = compassPoint(angleDeg, radius);
  el.setAttribute("x", p.x.toFixed(1));
  el.setAttribute("y", p.y.toFixed(1));
  el.setAttribute("transform", `rotate(${-azimuth} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
}

// A minor arc (<=45 deg) between two angles (deg, clockwise from local "up"), at `r`.
function arcPath(fromDeg, toDeg, r) {
  const p1 = compassPoint(fromDeg, r);
  const p2 = compassPoint(toDeg, r);
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

const DIM_TICK_HALF = 4; // half-length of the little perpendicular tick at each end of a dimension line

// Draws a dimension line from p1 to p2 (both in the building-axis local frame) with a small
// perpendicular tick at each end and a label at `labelPos`, counter-rotated to stay upright.
function setDimensionLine(ids, p1, p2, labelPos, labelText, azimuth) {
  setLine($(ids.line), p1, p2);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * DIM_TICK_HALF;
  const py = (dx / len) * DIM_TICK_HALF;
  setLine($(ids.tick1), { x: p1.x - px, y: p1.y - py }, { x: p1.x + px, y: p1.y + py });
  setLine($(ids.tick2), { x: p2.x - px, y: p2.y - py }, { x: p2.x + px, y: p2.y + py });

  const label = $(ids.label);
  label.textContent = labelText;
  label.setAttribute("x", labelPos.x.toFixed(1));
  label.setAttribute("y", labelPos.y.toFixed(1));
  label.setAttribute("transform", `rotate(${-azimuth} ${labelPos.x.toFixed(1)} ${labelPos.y.toFixed(1)})`);
}

function renderCompass() {
  const azimuth = parseFloat($("azimuth").value) || 0;
  const b = parseFloat($("bldB")?.value) || 20;
  const d = parseFloat($("bldD")?.value) || 15;
  const type = BUILDING_TYPES.find((t) => t.id === $("buildingType")?.value) || BUILDING_TYPES[0];

  const roofType = $("roofType")?.value || "gable";
  const rectEl = $("buildingRect");
  const circleEl = $("buildingCircle");
  const lattice1 = $("latticeCross1");
  const lattice2 = $("latticeCross2");

  let halfB, halfD; // half-extents of whatever's drawn, used below to size the +-45 deg arcs

  if (type.glyph === "circle") {
    // Circular bins/silos/tanks, flags and other circular shapes -- diameter from W, L unused.
    const radius = Math.max(9, Math.min(COMPASS_MAX_HALF_SPAN, (b / 2) * (COMPASS_MAX_HALF_SPAN / 10)));
    circleEl.setAttribute("cx", COMPASS_CX.toFixed(1));
    circleEl.setAttribute("cy", COMPASS_CY.toFixed(1));
    circleEl.setAttribute("r", radius.toFixed(1));
    setHidden(circleEl, false);
    setHidden(rectEl, true);
    setHidden(lattice1, true);
    setHidden(lattice2, true);
    halfB = halfD = radius;
  } else {
    // Rectangle-based glyphs: "rect" (enclosed building, W x L), "wall" (freestanding wall/hoarding --
    // long and thin, thickness fixed regardless of L), "lattice" (exposed members/lattice tower -- W x L
    // rectangle with a cross-brace to distinguish it from a plain enclosed building).
    const thickness = type.glyph === "wall" ? 9 : null; // fixed half-thickness for a wall glyph
    const longest = Math.max(b, d, 0.1);
    const scale = COMPASS_MAX_HALF_SPAN / (longest / 2);
    halfB = Math.max(9, (b * scale) / 2);
    halfD = thickness !== null ? thickness : Math.max(9, (d * scale) / 2);

    rectEl.setAttribute("x", (COMPASS_CX - halfB).toFixed(1));
    rectEl.setAttribute("y", (COMPASS_CY - halfD).toFixed(1));
    rectEl.setAttribute("width", (halfB * 2).toFixed(1));
    rectEl.setAttribute("height", (halfD * 2).toFixed(1));
    setHidden(rectEl, false);
    setHidden(circleEl, true);

    if (type.glyph === "lattice") {
      setLine(lattice1, { x: COMPASS_CX - halfB, y: COMPASS_CY - halfD }, { x: COMPASS_CX + halfB, y: COMPASS_CY + halfD });
      setLine(lattice2, { x: COMPASS_CX - halfB, y: COMPASS_CY + halfD }, { x: COMPASS_CX + halfB, y: COMPASS_CY - halfD });
      setHidden(lattice1, false);
      setHidden(lattice2, false);
    } else {
      setHidden(lattice1, true);
      setHidden(lattice2, true);
    }
  }

  // Roof ridge / hip lines -- only meaningful on the plain enclosed-building rectangle. The ridge
  // runs parallel to W (across the theta=0 wind); a hip roof also gets lines to the four corners;
  // a monoslope has no ridge at all.
  const ridgeIds = ["roofRidge", "roofHip1", "roofHip2", "roofHip3", "roofHip4"];
  ridgeIds.forEach((id) => setHidden($(id), true));
  if (type.glyph === "rect" && roofType !== "monoslope") {
    if (roofType === "gable") {
      setLine($("roofRidge"), { x: COMPASS_CX - halfB, y: COMPASS_CY }, { x: COMPASS_CX + halfB, y: COMPASS_CY });
      setHidden($("roofRidge"), false);
    } else if (roofType === "hip") {
      const ridgeHalf = Math.max(0, halfB - halfD);
      setLine($("roofRidge"), { x: COMPASS_CX - ridgeHalf, y: COMPASS_CY }, { x: COMPASS_CX + ridgeHalf, y: COMPASS_CY });
      setLine($("roofHip1"), { x: COMPASS_CX - ridgeHalf, y: COMPASS_CY }, { x: COMPASS_CX - halfB, y: COMPASS_CY - halfD });
      setLine($("roofHip2"), { x: COMPASS_CX - ridgeHalf, y: COMPASS_CY }, { x: COMPASS_CX - halfB, y: COMPASS_CY + halfD });
      setLine($("roofHip3"), { x: COMPASS_CX + ridgeHalf, y: COMPASS_CY }, { x: COMPASS_CX + halfB, y: COMPASS_CY - halfD });
      setLine($("roofHip4"), { x: COMPASS_CX + ridgeHalf, y: COMPASS_CY }, { x: COMPASS_CX + halfB, y: COMPASS_CY + halfD });
      ridgeIds.forEach((id) => setHidden($(id), false));
    }
  }

  $("buildingGroup").setAttribute("transform", `rotate(${azimuth} ${COMPASS_CX} ${COMPASS_CY})`);

  // Dimension lines: dimW is always shown (W for rect/wall/lattice, diameter for circles); dimL
  // only where a second, independent dimension actually exists (rect/lattice -- a wall's depth is
  // a fixed symbolic thickness, not the real L value, and a circle only has one dimension).
  const dimGap = 7;
  if (type.glyph === "circle") {
    setDimensionLine(
      { line: "dimWLine", tick1: "dimWTick1", tick2: "dimWTick2", label: "dimWLabel" },
      { x: COMPASS_CX - halfB, y: COMPASS_CY },
      { x: COMPASS_CX + halfB, y: COMPASS_CY },
      { x: COMPASS_CX, y: COMPASS_CY - dimGap },
      `⌀ = ${fmt(b, 1)} m`,
      azimuth
    );
    setHidden($("dimL"), true);
  } else {
    setDimensionLine(
      { line: "dimWLine", tick1: "dimWTick1", tick2: "dimWTick2", label: "dimWLabel" },
      { x: COMPASS_CX - halfB, y: COMPASS_CY - halfD - dimGap },
      { x: COMPASS_CX + halfB, y: COMPASS_CY - halfD - dimGap },
      { x: COMPASS_CX, y: COMPASS_CY - halfD - dimGap - 5 },
      `W = ${fmt(b, 1)} m`,
      azimuth
    );
    if (type.glyph === "wall") {
      setHidden($("dimL"), true);
    } else {
      // Label sits just above the top end of the line (not centred on it) -- centred would put it
      // on the same local-angle-90 ray, and at the same height, as theta90Label further out.
      setDimensionLine(
        { line: "dimLLine", tick1: "dimLTick1", tick2: "dimLTick2", label: "dimLLabel" },
        { x: COMPASS_CX + halfB + dimGap, y: COMPASS_CY - halfD },
        { x: COMPASS_CX + halfB + dimGap, y: COMPASS_CY + halfD },
        { x: COMPASS_CX + halfB + dimGap + 4, y: COMPASS_CY - halfD - 4 },
        `L = ${fmt(d, 1)} m`,
        azimuth
      );
      setHidden($("dimL"), false);
    }
  }
  setHidden($("dimW"), false);

  // Orthogonal-axis furniture (theta=0/90 dashed axes, +-45 deg sector arcs, and the matching
  // callout) only makes sense for a shape with discrete faces -- hide it for circular shapes.
  const axisEls = [$("axisTheta0"), $("axisTheta90"), $("arcLeft"), $("arcRight"), $("arcLeftLabel"), $("arcRightLabel"), $("theta0Label"), $("theta90Label")];
  axisEls.forEach((el) => setHidden(el, !type.hasAxes));
  setHidden($("calloutAxes"), !type.hasAxes);

  if (!type.hasAxes) return;

  // theta=0 / theta=90 dashed axes through the building, each a full diameter (2 x COMPASS_AXIS_R)
  setLine($("axisTheta0"), compassPoint(180, COMPASS_AXIS_R), compassPoint(0, COMPASS_AXIS_R));
  setLine($("axisTheta90"), compassPoint(270, COMPASS_AXIS_R), compassPoint(90, COMPASS_AXIS_R));

  placeRotatingLabel($("theta0Label"), 0, COMPASS_AXIS_R + 14, azimuth);
  placeRotatingLabel($("theta90Label"), 90, COMPASS_AXIS_R + 16, azimuth);

  // +-45 deg sector arcs either side of theta=0 (Clause 2.3), radius scaled to clear the glyph
  const halfDiagonal = Math.sqrt(halfB * halfB + halfD * halfD);
  const arcR = Math.min(COMPASS_ARC_MAX_R, Math.max(COMPASS_ARC_MIN_R, halfDiagonal + 12));
  $("arcLeft").setAttribute("d", arcPath(-45, 0, arcR));
  $("arcRight").setAttribute("d", arcPath(0, 45, arcR));
  placeRotatingLabel($("arcLeftLabel"), -22.5, arcR + 13, azimuth);
  placeRotatingLabel($("arcRightLabel"), 22.5, arcR + 13, azimuth);
}

// ---------------------------------------------------------------------------
// Isometric diagram (Section 1) -- a schematic 3D view built from the same
// building type / roof type / W x L x h inputs as the compass, at a FIXED
// camera angle. A fixed camera (rather than one that rotates with azimuth)
// means the set of visible/hidden faces never changes, so occlusion can be
// hard-coded per shape instead of needing general hidden-surface removal.
// ---------------------------------------------------------------------------

const ISO_ANGLE_RAD = Math.PI / 6; // 30 deg, standard isometric
const ISO_VB_CX = 140;
const ISO_VB_CY = 128;
const ISO_TARGET_W = 220; // fit-to-box budget inside the 280x250 viewBox
const ISO_TARGET_H = 186;

// Unrotated, unscaled isometric projection of a local (x=across W, y=along L,
// z=up) point. x-y and x+y are the two isometric screen axes; z lifts the
// point up the screen (SVG y grows downward, so subtracting z moves it up).
function isoProjectRaw(p) {
  return {
    sx: (p.x - p.y) * Math.cos(ISO_ANGLE_RAD),
    sy: (p.x + p.y) * Math.sin(ISO_ANGLE_RAD) - p.z,
  };
}

// A rectangular box (base 2*hw x 2*hl, wall height H) with a roof on top.
// Camera sees the +x and +y walls/roof slopes only -- the -x/-y faces and
// the underside are never drawn, so no depth sorting is needed between them.
function buildIsoBox(hw, hl, H, pitchRad, roofType) {
  const A = { x: -hw, y: -hl, z: 0 };
  const B = { x: hw, y: -hl, z: 0 };
  const C = { x: hw, y: hl, z: 0 };
  const D = { x: -hw, y: hl, z: 0 };
  const A2 = { x: -hw, y: -hl, z: H };
  const B2 = { x: hw, y: -hl, z: H };
  const C2 = { x: hw, y: hl, z: H };
  const D2 = { x: -hw, y: hl, z: H };
  const polys = [];

  if (roofType === "flat") {
    polys.push({ pts: [D, C, C2, D2], cls: "iso-wall" });
    polys.push({ pts: [B, C, C2, B2], cls: "iso-wall-alt" });
    polys.push({ pts: [A2, B2, C2, D2], cls: "iso-roof" });
  } else if (roofType === "gable") {
    // Ridge runs full-length parallel to W (matches the compass ridge line).
    const rise = hl * Math.tan(pitchRad);
    const R1 = { x: -hw, y: 0, z: H + rise };
    const R2 = { x: hw, y: 0, z: H + rise };
    polys.push({ pts: [D, C, C2, D2], cls: "iso-wall" }); // eave wall
    polys.push({ pts: [B, C, C2, R2, B2], cls: "iso-gable" }); // gable end wall
    polys.push({ pts: [D2, C2, R2, R1], cls: "iso-roof" }); // near roof slope
  } else if (roofType === "hip") {
    // Ridge inset by the shorter half-dimension (equal-pitch hip), matching the compass.
    const rise = Math.min(hw, hl) * Math.tan(pitchRad);
    const ridgeHalf = Math.max(0, hw - hl);
    const R1 = { x: -ridgeHalf, y: 0, z: H + rise };
    const R2 = { x: ridgeHalf, y: 0, z: H + rise };
    polys.push({ pts: [D, C, C2, D2], cls: "iso-wall" });
    polys.push({ pts: [B, C, C2, B2], cls: "iso-wall-alt" });
    polys.push({ pts: [D2, C2, R2, R1], cls: "iso-roof" }); // long-side slope
    polys.push({ pts: [B2, C2, R2], cls: "iso-roof-alt" }); // hip-end slope
  } else {
    // Monoslope: single plane, low eave at y=-hl, high eave at y=+hl.
    const rise = 2 * hl * Math.tan(pitchRad);
    const C2h = { x: hw, y: hl, z: H + rise };
    const D2h = { x: -hw, y: hl, z: H + rise };
    polys.push({ pts: [D, C, C2h, D2h], cls: "iso-wall" }); // high-side wall
    polys.push({ pts: [B, C, C2h, B2], cls: "iso-wall-alt" }); // sloped side wall
    polys.push({ pts: [A2, B2, C2h, D2h], cls: "iso-roof" }); // roof plane
  }

  return { polys, lines: [] };
}

// A vertical cylinder (circular bins/silos/tanks, flags/circular shapes): a full top
// cap, and only the near (camera-facing) half of the wall -- the true silhouette of
// an isometric circle sits at +/-45 deg either side of the diagonal facing the camera.
function buildIsoCylinder(r, H) {
  const N_FULL = 24;
  const topRim = [];
  for (let i = 0; i < N_FULL; i++) {
    const theta = (i / N_FULL) * 2 * Math.PI;
    topRim.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z: H });
  }
  const N_FRONT = 13;
  const frontTop = [];
  const frontBottom = [];
  for (let i = 0; i < N_FRONT; i++) {
    const theta = ((-45 + (180 * i) / (N_FRONT - 1)) * Math.PI) / 180;
    frontTop.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z: H });
    frontBottom.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z: 0 });
  }
  const sidePts = frontBottom.concat(frontTop.slice().reverse());
  return {
    polys: [
      { pts: sidePts, cls: "iso-wall" },
      { pts: topRim, cls: "iso-roof" },
    ],
    lines: [],
  };
}

// An open lattice tower / exposed frame: corner legs, top/base outlines, and
// X-bracing on the two visible faces, all as strokes (no fill -- it's a lattice).
function buildIsoLatticeTower(hw, hl, H) {
  const A = { x: -hw, y: -hl, z: 0 };
  const B = { x: hw, y: -hl, z: 0 };
  const C = { x: hw, y: hl, z: 0 };
  const D = { x: -hw, y: hl, z: 0 };
  const A2 = { x: -hw, y: -hl, z: H };
  const B2 = { x: hw, y: -hl, z: H };
  const C2 = { x: hw, y: hl, z: H };
  const D2 = { x: -hw, y: hl, z: H };
  const L = (p1, p2, cls) => ({ p1, p2, cls });
  return {
    polys: [],
    lines: [
      L(A, A2, "iso-lattice"),
      L(B, B2, "iso-lattice"),
      L(C, C2, "iso-lattice"),
      L(D, D2, "iso-lattice"),
      L(A2, B2, "iso-lattice"),
      L(B2, C2, "iso-lattice"),
      L(C2, D2, "iso-lattice"),
      L(D2, A2, "iso-lattice"),
      L(A, B, "iso-lattice-base"),
      L(B, C, "iso-lattice-base"),
      L(C, D, "iso-lattice-base"),
      L(D, A, "iso-lattice-base"),
      L(B, C2, "iso-lattice-brace"),
      L(C, B2, "iso-lattice-brace"),
      L(D, C2, "iso-lattice-brace"),
      L(C, D2, "iso-lattice-brace"),
    ],
  };
}

// Projects every point in `shape` at once, fitting the whole drawing (whatever its
// aspect ratio -- a flat wide shed or a tall thin tower) into the target box.
function renderIsoShapeToSvg(shape) {
  const allPts = [];
  shape.polys.forEach((p) => allPts.push(...p.pts));
  shape.lines.forEach((l) => allPts.push(l.p1, l.p2));
  if (allPts.length === 0) return "";

  const raw = allPts.map(isoProjectRaw);
  const minX = Math.min(...raw.map((p) => p.sx));
  const maxX = Math.max(...raw.map((p) => p.sx));
  const minY = Math.min(...raw.map((p) => p.sy));
  const maxY = Math.max(...raw.map((p) => p.sy));
  const rawW = Math.max(maxX - minX, 0.01);
  const rawH = Math.max(maxY - minY, 0.01);
  const scale = Math.min(ISO_TARGET_W / rawW, ISO_TARGET_H / rawH);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  function project(p) {
    const r = isoProjectRaw(p);
    return { x: ISO_VB_CX + (r.sx - cx) * scale, y: ISO_VB_CY + (r.sy - cy) * scale };
  }

  let out = "";
  shape.polys.forEach((poly) => {
    const pts = poly.pts.map(project).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    out += `<polygon points="${pts}" class="${poly.cls}" />`;
  });
  shape.lines.forEach((line) => {
    const p1 = project(line.p1);
    const p2 = project(line.p2);
    out += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" class="${line.cls}" />`;
  });
  return out;
}

function renderIsometric() {
  const svg = $("isoSvg");
  if (!svg) return;

  const type = BUILDING_TYPES.find((t) => t.id === $("buildingType")?.value) || BUILDING_TYPES[0];
  const roofType = $("roofType")?.value || "gable";
  const b = parseFloat($("bldB")?.value) || 20;
  const d = parseFloat($("bldD")?.value) || 15;
  const h = parseFloat($("bldH")?.value) || 10;
  const pitchDeg = parseFloat($("roofPitch")?.value) || 0;

  const hw = Math.max(b, 0.1) / 2;
  const hl = Math.max(d, 0.1) / 2;
  const H = Math.max(h, 0.1);
  const pitchRad = (Math.max(0, Math.min(60, pitchDeg)) * Math.PI) / 180;

  let shape;
  if (type.glyph === "circle") {
    shape = buildIsoCylinder(hw, H);
  } else if (type.glyph === "wall") {
    const thickness = Math.max(hw * 0.04, 0.4);
    shape = buildIsoBox(hw, thickness, H, 0, "flat");
  } else if (type.glyph === "lattice") {
    shape = buildIsoLatticeTower(hw, hl, H);
  } else {
    shape = buildIsoBox(hw, hl, H, pitchRad, roofType);
  }

  svg.innerHTML = renderIsoShapeToSvg(shape);
}

function renderDiagrams() {
  renderCompass();
  renderIsometric();
}

function setAzimuthFromCompassEvent(evt) {
  const svg = $("compassSvg");
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const local = pt.matrixTransform(ctm.inverse());
  const dx = local.x - COMPASS_CX;
  const dy = local.y - COMPASS_CY;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return; // ignore clicks dead-centre
  let bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
  bearing = ((Math.round(bearing / 5) * 5) % 360 + 360) % 360;

  const azimuthSel = $("azimuth");
  azimuthSel.value = String(bearing);
  azimuthSel.dispatchEvent(new Event("change"));
}

function wireCompass() {
  const svg = $("compassSvg");
  let dragging = false;

  svg.addEventListener("pointerdown", (evt) => {
    dragging = true;
    setAzimuthFromCompassEvent(evt);
    try {
      svg.setPointerCapture(evt.pointerId);
    } catch (e) {
      // Some environments (or synthetic pointer ids) don't support capture --
      // dragging still works within the element bounds without it.
    }
  });
  svg.addEventListener("pointermove", (evt) => {
    if (!dragging) return;
    setAzimuthFromCompassEvent(evt);
  });
  svg.addEventListener("pointerup", (evt) => {
    dragging = false;
    try {
      svg.releasePointerCapture(evt.pointerId);
    } catch (e) {
      // no-op if capture was never established
    }
  });
  svg.addEventListener("pointercancel", () => {
    dragging = false;
  });

  $("azimuth").addEventListener("change", renderDiagrams);
  $("bldB")?.addEventListener("input", renderDiagrams);
  $("bldD")?.addEventListener("input", renderDiagrams);
  $("bldH")?.addEventListener("input", renderDiagrams);
  $("roofPitch")?.addEventListener("input", renderDiagrams);
  $("buildingType")?.addEventListener("change", renderDiagrams);
  $("roofType")?.addEventListener("change", renderDiagrams);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  populateRegions();
  populateLocations();
  populateAzimuth();
  populateBuildingTypes();
  populateImportanceLevels();
  populateRoofTypes();
  populateBuildingSizes();
  populateAri();
  populateCpiCases();
  wireTopographyControls();
  wireCompass();
  renderDiagrams();

  $("calcSpeeds").addEventListener("click", runSpeedCalc);
  $("calcPressure").addEventListener("click", renderPressureResults);
});
