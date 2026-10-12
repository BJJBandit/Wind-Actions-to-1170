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

  // Default the calculator to a real starting example (Hobart -> Region A4) rather than an
  // unset "pick manually" dropdown -- still fully overridable via either dropdown.
  sel.value = "Hobart, TAS";
  sel.dispatchEvent(new Event("change"));
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

// A troughed (inverted gable) roof only has pressure coefficients as a free roof (Appendix B,
// Table B.6) -- Section 5's enclosed-building tables don't cover it -- so it's only offered for
// the open building type, and an existing selection falls back to gable when switching away.
function syncRoofTypeOptions() {
  const sel = $("roofType");
  if (!sel) return;
  const isOpen = $("buildingType")?.value === "open";
  Array.from(sel.options).forEach((opt) => {
    if (opt.value === "troughed") {
      opt.disabled = !isOpen;
      opt.hidden = !isOpen;
    }
  });
  if (!isOpen && sel.value === "troughed") {
    sel.value = "gable";
    sel.dispatchEvent(new Event("change"));
  }
}

// Section 3's heading/intro and the plan/elevation hints describe walls + enclosed-building tables;
// swap them for the roof-only Appendix B wording when the open building type is selected.
const pressureTextDefaults = {};
function setPressureSectionText(isOpen) {
  const ids = ["pressureTitle", "pressureTitleRef", "pressureIntro", "planHint", "elevHint"];
  const openText = {
    pressureTitle: "3. Design wind pressure &ndash; open building (free roof)",
    pressureTitleRef: "(Appendix B, Cl B.3)",
    pressureIntro: `Calculates roof net pressures C<sub>p,n</sub> for <strong>all 4 building orthogonal axes</strong> (Clause 2.5.2's
      minimum), each using its own governing V<sub>des,θ</sub> from Section&nbsp;2. There are no walls and no internal pressure; the
      coefficients come from Tables B.4(A)/(B) (monoslope), B.5 (pitched) and B.6 (troughed) and depend on the roof pitch, h/d and how
      much of the space under the roof is blocked. Hip roofs have no free-roof table. K<sub>a</sub> and the local pressure factor K
      (Table B.1) are taken as 1.0 &mdash; apply them separately for local-pressure (fixing) design.`,
    planHint: "Plan view, wind from the top. The roof is split into its windward / leeward bands; small squares mark the support posts.",
    elevHint: "Elevation (section) along the wind path, wind from the left. The roof line is coloured by band; posts shown at each end.",
  };
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (!(id in pressureTextDefaults)) pressureTextDefaults[id] = el.innerHTML;
    el.innerHTML = isOpen ? openText[id] : pressureTextDefaults[id];
  });
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

    // Open buildings (free roofs): there's no enclosed volume, so no internal pressure -- the
    // internal-pressure case is irrelevant -- but the blockage under the roof matters (Cl B.3.1).
    const isOpen = !!type && type.id === "open";
    $("blockageWrap").hidden = !isOpen;
    $("cpiCase").disabled = isOpen;
    $("cpiCase").title = isOpen ? "Not used for open buildings -- net pressure coefficients already combine both roof faces" : "";
    syncRoofTypeOptions();
    setPressureSectionText(isOpen);

    if (!type || type.supported) {
      gate.hidden = true;
      note.innerHTML = isOpen
        ? `<div class="note">Open building (free roof): Section&nbsp;3 uses Appendix&nbsp;B net pressure coefficients C<sub>p,n</sub> for the roof
            (Tables B.4&ndash;B.6) &mdash; there are no walls and no internal pressure. The elevation/plan diagrams show the roof only.</div>`
        : "";
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
    if (il.ariUls === null) {
      note.innerHTML = `<div class="note">"Other" doesn't suggest an ARI &mdash; pick the R value directly in the dropdown below
        (e.g. from a performance-based assessment, a temporary structure, or a design working life other than 50 years).</div>`;
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

  // Default to IL2 (the common case) so the ARI below already reflects it on page load, rather
  // than requiring the user to touch this dropdown first.
  sel.value = "IL2";
  sel.dispatchEvent(new Event("change"));
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
  syncRoofTypeOptions();
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
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All cases of Table 5.1(A) (envelope — every case checked)";
  sel.appendChild(allOpt);
  CPI_CASES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
  sel.value = CPI_CASES[0].id; // keep the original default; "All cases" is an explicit opt-in
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
  lastDesignResults = designResults; // cached for Section 3's per-axis pressure calc

  renderSpeedResults({ region: regionKey, R, terrainCategory, z, siteResult, designResults, mt });
}

// ---------------------------------------------------------------------------
// Section B: design wind pressure
// ---------------------------------------------------------------------------

// Cached from the last "Calculate wind speeds" run (Section 2) -- an array of the 4 orthogonal-axis
// {label, theta (bearing), Vdes} entries from computeDesignWindSpeeds(). Section 3 uses this to price
// every axis with its own governing Vdes,theta rather than one manually-entered value.
let lastDesignResults = null;

// Cached from the last "Calculate wind pressures" run -- the full per-axis wall/roof pressure results
// (same array built in renderPressureResults). The plan/elevation diagrams redraw from this on a
// direction-dropdown change without recomputing anything.
let lastAxisResults = null;

// Computes wall + roof pressure rows for ONE building orthogonal axis. `b`/`d` must already be the
// EFFECTIVE across-wind / along-wind dimensions for THIS axis's wind direction -- for the two axes
// where wind is parallel to the ridge, that's the building's W and L swapped relative to the ridge-
// normal axes, since AS/NZS 1170.2's d/b (leeward wall) and h/d (roof) ratios are always defined
// relative to the current wind direction, not fixed to the building's W/L labelling.
function computeAxisPressures({ Vdes, Cdyn, b, d, h, pitch, roofType, ridgeTheta, cpiCase }) {
  const db = d / b;
  const bOverD = b / d;
  const hd = h / d;

  const cpeWw = cpeWindwardWall(h);
  const cpeLw = cpeLeewardWall({ theta: ridgeTheta, pitch, db, roofType });
  // For a hip roof, Table 5.2(B) Note 3 sends the leeward wall to the theta=0 branch even at theta=90.
  const leewardUsesTheta0 = ridgeTheta === 0 || roofType === "hip";
  const leewardTableMinDb = !leewardUsesTheta0 || pitch < 10 ? 1 : pitch >= 25 ? 0.1 : null;
  const leewardTableMaxDb = !leewardUsesTheta0 || pitch < 10 ? 4 : pitch >= 25 ? 0.3 : null;
  const dbOutOfRange = leewardTableMinDb !== null && (db < leewardTableMinDb || db > leewardTableMaxDb);

  let cpiValues;
  let cpiLabel;
  if (cpiCase.id === "all") {
    // Envelope of every Table 5.1(A) case: case (a) gives Cp,i = Cp,e(windward wall), the rest are
    // fixed values. Deduplicated and sorted so each surface is checked against each distinct Cp,i.
    const set = new Map();
    CPI_CASES.forEach((c) => {
      (c.cpi === "cpe_ww" ? [cpeWw] : c.cpi).forEach((v) => set.set(round2(v), round2(v)));
    });
    cpiValues = Array.from(set.values()).sort((x, y) => x - y);
    cpiLabel = `all Table 5.1(A) cases: ${cpiValues.map((v) => v.toFixed(2)).join(", ")}`;
  } else if (cpiCase.cpi === "cpe_ww") {
    cpiValues = [cpeWw];
    cpiLabel = "= Cp,e (windward wall)";
  } else {
    cpiValues = cpiCase.cpi;
    cpiLabel = cpiValues.map((v) => v.toFixed(2)).join(" or ");
  }

  function netRows(surfaceLabel, cpeValues) {
    return cpeValues.flatMap((cpe) =>
      cpiValues.map((cpi) => {
        const netCshp = cpe - cpi; // Ka=Kc=Kl=Kp=1
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

  let roofRows = [];
  let roofTableRef = "";
  let roofUnavailableNote = "";

  if (roofType === "troughed") {
    roofUnavailableNote = `A troughed roof has no enclosed-building tables in Section 5 &mdash; it is only covered as a free roof
      (Appendix B, Table B.6). Switch the building type to "Open building (free roof)".`;
  } else if (pitch < 10) {
    const roofZones = cpeRoofLowPitch(hd);
    roofRows = roofZones.flatMap((z) => netRows(`Roof, ${z.label}`, Array.isArray(z.values) ? z.values : []).map((r) => ({ ...r, note: z.note })));
    roofTableRef = "Table 5.3(A)";
  } else if (pitch <= 45 && ridgeTheta === 0) {
    const upwindPair = cpeRoofUpwindPitched(hd, pitch);
    roofRows = netRows("Roof, windward (upwind) slope", upwindPair);
    if (roofType === "monoslope") {
      roofTableRef = "Table 5.3(B) (single slope)";
    } else {
      const downwindVal = cpeRoofDownwindPitched(hd, pitch, bOverD);
      roofRows = roofRows.concat(netRows("Roof, leeward (downwind) slope", [downwindVal]));
      if (roofType === "hip") {
        roofRows = roofRows.concat(netRows("Roof, hip-end slopes (R)", [downwindVal]));
      }
      roofTableRef = "Tables 5.3(B)/(C)";
    }
  } else if (pitch <= 45 && ridgeTheta === 90) {
    roofUnavailableNote = `Roof pitch ≥ 10° with wind parallel to the ridge (crosswind): AS/NZS 1170.2 Tables 5.3(B)/(C) only tabulate the
      upwind/downwind case (wind normal to ridge) for this pitch range &mdash; source a C<sub>p,e</sub> value from the Standard directly
      for this direction.`;
  } else {
    roofUnavailableNote = `Roof pitch &gt; 45°: outside the tabulated range of Table 5.3(B) &mdash; source a C<sub>p,e</sub> value directly.`;
  }

  return { db, hd, bOverD, cpeLw, cpiLabel, dbOutOfRange, leewardTableMinDb, leewardTableMaxDb, wallRows, roofRows, roofTableRef, roofUnavailableNote };
}

// `markGoverning`: bold the largest-|pNet| row of each surface (used when many Cp,i cases are listed).
function rowsToHtml(rows, markGoverning = false) {
  const govBySurface = new Map();
  if (markGoverning) {
    rows.forEach((r) => {
      const cur = govBySurface.get(r.surfaceLabel);
      if (!cur || Math.abs(r.pNet) > Math.abs(cur.pNet)) govBySurface.set(r.surfaceLabel, r);
    });
  }
  let lastKey = null;
  return rows
    .map((r) => {
      const noteKey = `${r.surfaceLabel}|${r.note || ""}`;
      const showNote = r.note && noteKey !== lastKey;
      lastKey = noteKey;
      const gov = markGoverning && govBySurface.get(r.surfaceLabel) === r;
      return `<tr${gov ? ' class="gov-row"' : ""}>
          <td>${r.surfaceLabel}</td>
          <td class="num">${cpeSpan(r.cpe)}</td>
          <td class="num">${cpeSpan(r.cpi)}</td>
          <td class="num">${fmt(r.pExt, 2)}</td>
          <td class="num">${fmt(r.pInt, 2)}</td>
          <td class="num">${fmt(r.pNet, 2)}</td>
        </tr>${showNote ? `<tr><td colspan="6" class="note">${r.note}</td></tr>` : ""}`;
    })
    .join("");
}

// Open building (free roof): Appendix B, Clause B.3. There are no walls and no internal pressure --
// the tabulated net coefficients Cp,n already combine the upper and lower roof surfaces (positive
// = net DOWNWARD). Cp,w applies to the windward half of the roof, Cp,l to the leeward half, and the
// Standard requires ALL combinations of the listed alternatives to be checked. Ka and the local
// pressure factor K (Table B.1) are taken as 1.0 here, as everywhere else in this tool.
function computeOpenAxisPressures({ Vdes, Cdyn, d, h, pitch, roofType, axisIndex, blockedPct }) {
  const hd = h / d;
  // axis 0 = wind from the low edge (theta=0), axis 2 = from the high edge (theta=180) -- only
  // distinguishable for a monoslope; pitched/troughed roofs are symmetric. axes 1/3 = parallel to ridge.
  const theta = axisIndex % 2 === 1 ? 90 : axisIndex === 2 ? 180 : 0;
  const res = freeRoofCases({ roofType, pitch, theta, hd, blockedPct });
  const p = (cn) => (windPressure(Vdes, cn, Cdyn) / 1000);

  if (res.unavailable) {
    return { db: NaN, hd, bOverD: NaN, cpeLw: null, cpiLabel: "n/a (open building)", dbOutOfRange: false,
      wallRows: [], roofRows: [], roofTableRef: "Appendix B", roofUnavailableNote: res.unavailable, isOpen: true, openEntries: [], openNotes: [], openMode: "halves", openCombos: [] };
  }

  const roofRows = [];
  res.entries.forEach((e) => {
    e.values.forEach((cn) => {
      roofRows.push({ surfaceLabel: `Roof, ${e.label}`, cpeRaw: cn, cpe: cn, kp: 1, cpi: 0, pExt: p(cn), pInt: 0, pNet: p(cn), entryLabel: e.label });
    });
  });

  // "All combinations" of Cp,w with Cp,l (halves mode only) -- each combination is one load case.
  const combos = [];
  if (res.mode === "halves") {
    const w = res.entries[0].values;
    const l = res.entries[1].values;
    w.forEach((cw) => l.forEach((cl) => combos.push({ cw, cl, pw: p(cw), pl: p(cl) })));
  }

  return {
    db: NaN, hd, bOverD: NaN, cpeLw: null, cpiLabel: "n/a (open building)", dbOutOfRange: false,
    wallRows: [], roofRows, roofTableRef: `Appendix B (${roofType === "monoslope" ? "Table B.4" : roofType === "troughed" ? "Table B.6" : "Table B.5"})`,
    roofUnavailableNote: "", isOpen: true, openEntries: res.entries, openNotes: res.notes, openMode: res.mode, openCombos: combos,
    openTheta: theta,
  };
}

function renderPressureResults() {
  const type = BUILDING_TYPES.find((t) => t.id === $("buildingType").value);
  if (type && !type.supported) return; // defence-in-depth -- the button is disabled for this case

  const Cdyn = parseFloat($("pCdyn").value) || 1.0;
  const bldB = parseFloat($("bldB").value) || 1;
  const bldD = parseFloat($("bldD").value) || 1;
  const h = parseFloat($("bldH").value) || 1;
  const pitch = parseFloat($("roofPitch").value) || 0;
  const roofType = $("roofType").value || "gable";
  const cpiCase = $("cpiCase").value === "all" ? { id: "all" } : CPI_CASES.find((c) => c.id === $("cpiCase").value);
  const blockedPct = Math.max(0, Math.min(100, parseFloat($("blockedPct")?.value) || 0));

  // Prefer the 4 axis-specific Vdes,theta values from Section 2; fall back to the single manually
  // entered value (for all 4 axes) if Section 2 hasn't been run yet in this session.
  let axesSource;
  let usingFallback = false;
  if (lastDesignResults && lastDesignResults.length === 4) {
    axesSource = lastDesignResults;
  } else {
    usingFallback = true;
    const fallbackVdes = parseFloat($("pVdes").value) || 0;
    const labels = ["θ=0° (front)", "θ=90°", "θ=180°", "θ=270°"];
    axesSource = labels.map((label, i) => ({ label, theta: [0, 90, 180, 270][i], Vdes: fallbackVdes }));
  }

  // Axis index 0/2 = front/back (wind normal to ridge, onto W); index 1/3 = sides (wind parallel to
  // ridge, onto L) -- so b/d swap relative to the building's own W/L for the side axes.
  const axisResults = axesSource.map((axis, i) => {
    const ridgeTheta = i % 2 === 0 ? 0 : 90;
    const b = ridgeTheta === 0 ? bldB : bldD;
    const d = ridgeTheta === 0 ? bldD : bldB;
    const calc =
      type && type.id === "open"
        ? computeOpenAxisPressures({ Vdes: axis.Vdes, Cdyn, d, h, pitch, roofType, axisIndex: i, blockedPct })
        : computeAxisPressures({ Vdes: axis.Vdes, Cdyn, b, d, h, pitch, roofType, ridgeTheta, cpiCase });
    return { label: axis.label, bearing: axis.theta, Vdes: axis.Vdes, ridgeTheta, b, d, h, pitch, roofType, ...calc };
  });
  lastAxisResults = axisResults; // cached for the plan/elevation pressure diagrams

  // Governing (largest-magnitude) net pressure across all 4 axes, for a quick top-line summary.
  function governing(rows) {
    if (!rows.length) return null;
    return rows.reduce((worst, r) => (Math.abs(r.pNet) > Math.abs(worst.row.pNet) ? { row: r } : worst), { row: rows[0] }).row;
  }
  const allWallRows = axisResults.flatMap((a) => a.wallRows.map((r) => ({ ...r, axisLabel: a.label })));
  const allRoofRows = axisResults.flatMap((a) => a.roofRows.map((r) => ({ ...r, axisLabel: a.label })));
  const governingWall = governing(allWallRows);
  const governingRoof = governing(allRoofRows);

  const el = $("pressureResults");
  el.hidden = false;

  const fallbackNote = usingFallback
    ? `<div class="warning">Section 2 hasn't been run yet in this session &mdash; using the manually entered V<sub>des,θ</sub>
        (${fmt(parseFloat($("pVdes").value) || 0, 1)} m/s) for all 4 directions. Run "Calculate wind speeds" above for the
        direction-specific governing speeds.</div>`
    : "";

  const summaryPills = `
    <div class="pill">Roof: ${ROOF_TYPES.find((r) => r.id === roofType)?.label || roofType}</div>
    ${governingWall ? `<div class="pill">Governing wall: <strong>${fmt(governingWall.pNet, 2)} kPa</strong> (${governingWall.surfaceLabel}, ${governingWall.axisLabel})</div>` : ""}
    ${governingRoof ? `<div class="pill">Governing roof: <strong>${fmt(governingRoof.pNet, 2)} kPa</strong> (${governingRoof.surfaceLabel}, ${governingRoof.axisLabel})</div>` : ""}
  `;

  const allCpi = !(type && type.id === "open") && cpiCase && cpiCase.id === "all";

  // Open building: roof-only, net coefficients Cp,n (no Cp,e / Cp,i split, no wall table).
  function openAxisBody(a) {
    if (!a.roofRows.length) {
      return a.roofUnavailableNote ? `<div class="warning">${a.roofUnavailableNote}</div>` : "";
    }
    const rows = a.roofRows
      .map(
        (r) => `<tr><td>${r.surfaceLabel}</td><td class="num">${cpeSpan(r.cpe)}</td><td class="num">${fmt(r.pNet, 2)}</td></tr>`
      )
      .join("");
    const combos = a.openCombos.length
      ? `<h4>Load case combinations <span class="ref">(Cl B.3.1 &mdash; all combinations of C<sub>p,w</sub> and C<sub>p,l</sub> to be checked)</span></h4>
          <table>
            <thead><tr><th>Case</th><th class="num">C<sub>p,w</sub></th><th class="num">C<sub>p,l</sub></th>
              <th class="num">p<sub>w</sub> (kPa)</th><th class="num">p<sub>l</sub> (kPa)</th></tr></thead>
            <tbody>${a.openCombos
              .map(
                (c, k) => `<tr><td>${k + 1}</td><td class="num">${cpeSpan(c.cw)}</td><td class="num">${cpeSpan(c.cl)}</td>
                  <td class="num">${fmt(c.pw, 2)}</td><td class="num">${fmt(c.pl, 2)}</td></tr>`
              )
              .join("")}</tbody>
          </table>`
      : "";
    const notes = a.openNotes.map((n) => `<div class="note">${n}</div>`).join("");
    return `
      <h4>Roof net pressures <span class="ref">(${a.roofTableRef})</span></h4>
      <table>
        <thead><tr><th>Zone</th><th class="num">C<sub>p,n</sub></th><th class="num">p<sub>net</sub> (kPa)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${combos}
      ${notes}`;
  }

  const axisBlocks = axisResults
    .map((a, i) => {
      if (a.isOpen) {
        const dirText =
          a.openTheta === 90
            ? "wind parallel to ridge"
            : roofType === "monoslope"
            ? a.openTheta === 180
              ? "wind down the slope (from the high edge)"
              : "wind up the slope (from the low edge)"
            : "wind normal to ridge";
        return `
        <details class="subpanel" ${i === 0 ? "open" : ""}>
          <summary>${a.label} &mdash; bearing ${fmt(a.bearing, 0)}°, V<sub>des,θ</sub> = ${fmt(a.Vdes, 1)} m/s
            <span class="ref">(${dirText})</span></summary>
          <div class="pill">h/d = ${fmt(a.hd, 2)}</div>
          <div class="pill">Blocked under roof: ${fmt(blockedPct, 0)}%</div>
          ${openAxisBody(a)}
        </details>`;
      }
      let dbNote = "";
      if (a.dbOutOfRange) {
        dbNote = `<div class="warning">d/b = ${fmt(a.db, 2)} is outside the tabulated range (${a.leewardTableMinDb}&ndash;${a.leewardTableMaxDb})
          for the leeward wall C<sub>p,e</sub> lookup (Table 5.2(B)) &mdash; the nearest tabulated boundary value has been used.</div>`;
      }
      let roofSection = "";
      if (a.roofRows.length) {
        roofSection = `
          <h4>Roof pressures <span class="ref">(${a.roofTableRef})</span></h4>
          <table>
            <thead><tr><th>Zone</th><th class="num">C<sub>p,e</sub></th><th class="num">C<sub>p,i</sub></th>
              <th class="num">p<sub>ext</sub> (kPa)</th><th class="num">p<sub>int</sub> (kPa)</th><th class="num">p<sub>net</sub> (kPa)</th></tr></thead>
            <tbody>${rowsToHtml(a.roofRows, allCpi)}</tbody>
          </table>`;
      } else if (a.roofUnavailableNote) {
        roofSection = `<div class="warning">${a.roofUnavailableNote}</div>`;
      }

      return `
        <details class="subpanel" ${i === 0 ? "open" : ""}>
          <summary>${a.label} &mdash; bearing ${fmt(a.bearing, 0)}°, V<sub>des,θ</sub> = ${fmt(a.Vdes, 1)} m/s
            <span class="ref">(${a.ridgeTheta === 0 ? "wind normal to ridge, onto W" : "wind parallel to ridge, onto L"})</span></summary>
          <div class="pill">d/b = ${fmt(a.db, 2)}</div>
          <div class="pill">h/d = ${fmt(a.hd, 2)}</div>
          <div class="pill">C<sub>p,i</sub> case: ${a.cpiLabel}</div>
          ${dbNote}
          <h4>Wall pressures <span class="ref">(Tables 5.2(A)&ndash;(C))</span></h4>
          <table>
            <thead><tr><th>Surface</th><th class="num">C<sub>p,e</sub></th><th class="num">C<sub>p,i</sub></th>
              <th class="num">p<sub>ext</sub> (kPa)</th><th class="num">p<sub>int</sub> (kPa)</th><th class="num">p<sub>net</sub> (kPa)</th></tr></thead>
            <tbody>${rowsToHtml(a.wallRows, allCpi)}</tbody>
          </table>
          ${allCpi ? `<div class="note">All Table 5.1(A) C<sub>p,i</sub> cases are listed; the <strong>bold row</strong> is the largest-magnitude
            p<sub>net</sub> for each surface.</div>` : ""}
          ${roofSection}
        </details>`;
    })
    .join("");

  let roofTypeNote = "";
  const isOpenType = type && type.id === "open";
  if (isOpenType) {
    roofTypeNote = `<div class="note"><strong>Open building (free roof), Appendix B:</strong> C<sub>p,n</sub> is the <em>net</em> pressure
      coefficient across the roof (upper minus lower surface) and is positive for net <em>downward</em> load. C<sub>p,w</sub> applies to the
      windward half and C<sub>p,l</sub> to the leeward half; every combination of the listed values is a load case. Roof types are limited
      to monoslope, pitched (gable) and troughed. h is taken as the average roof height and d as the along-wind roof depth.
      Blockage under the roof: ≤&nbsp;50% = &ldquo;empty under&rdquo;, ≥&nbsp;75% = &ldquo;blocked under&rdquo;, linear in between.
      K<sub>a</sub> and the local pressure factor K (Table B.1) are taken as 1.0.</div>`;
  } else if (roofType === "hip") {
    roofTypeNote = `<div class="note"><strong>Hip roof:</strong> the leeward wall C<sub>p,e</sub> uses the θ&nbsp;=&nbsp;0° values at
      every wind direction (Table 5.2(B), Note 3), and the hip-end (R) slopes use the same value as the downwind slope
      (Table 5.3(C), Clause 5.4.1(c)).</div>`;
  } else if (roofType === "monoslope") {
    roofTypeNote = `<div class="note"><strong>Monoslope / skillion roof:</strong> there is no ridge &mdash; the "front/back" axes mean wind
      up or down the single slope and the "side" axes mean wind across it. Table 5.2(B) does not tabulate a monoslope leeward wall, so
      the gable value is used there as an approximation &mdash; confirm against the Standard. For pitch ≥ 10°, only the up/down-slope
      axes are calculated (see each axis below); the across-slope axes are not covered by Tables 5.3(B)/(C).</div>`;
  }

  el.innerHTML = `
    ${fallbackNote}
    <div>${summaryPills}</div>
    ${roofTypeNote}
    ${axisBlocks}
    <p class="note">p = 0.5 &times; ρ<sub>air</sub>(1.2 kg/m&sup3;) &times; V<sub>des,θ</sub>&sup2; &times; C<sub>shp</sub> &times; C<sub>dyn</sub>
      (Equation 2.4(1)). Positive = pressure toward the surface, negative = suction. K<sub>a</sub>=K<sub>c</sub>=K<sub>l</sub>=K<sub>p</sub>=1.0 assumed.
      ${isOpenType
        ? "For an open building C<sub>shp</sub> = C<sub>p,n</sub>; h/d is relative to the along-wind roof depth for that axis."
        : "d/b and h/d are both relative to the wind direction for that axis (b = across-wind, d = along-wind), so they differ between the front/back and side axes."}</p>
  `;

  $("pressureDiagrams").hidden = false;
  renderPressureDiagrams();
}

// ---------------------------------------------------------------------------
// Plan & elevation pressure diagrams (Section 3) -- schematic, fixed-geometry views
// (not linked to the compass's azimuth) redrawn from the axis picked in the dropdown,
// using the cached per-axis results from the last "Calculate wind pressures" run.
// ---------------------------------------------------------------------------

function pressureFillClass(pNet) {
  return pNet >= 0 ? "press-pos" : "press-neg";
}

// Fill/stroke opacity scaled by |pNet| relative to the largest magnitude in the current
// view, so the diagram reads clearly regardless of the absolute pressure range.
function pressureOpacity(pNet, maxAbs) {
  if (!maxAbs) return "0.35";
  const frac = Math.min(1, Math.abs(pNet) / maxAbs);
  return (0.2 + 0.65 * frac).toFixed(2);
}

// A surface can have more than one row (Clause 5.4.1's two turbulence load cases, or more
// than one Cp,i value) -- the diagram shows whichever is more extreme; both stay listed in
// the detailed tables above.
function governingRowForSurface(rows, surfaceLabel) {
  const matches = rows.filter((r) => r.surfaceLabel === surfaceLabel);
  if (!matches.length) return null;
  return matches.reduce((worst, r) => (Math.abs(r.pNet) > Math.abs(worst.pNet) ? r : worst), matches[0]);
}

function windArrowSvg(x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 8;
  const a1 = angle + Math.PI * 0.8;
  const a2 = angle - Math.PI * 0.8;
  const hx1 = x2 + headLen * Math.cos(a1);
  const hy1 = y2 + headLen * Math.sin(a1);
  const hx2 = x2 + headLen * Math.cos(a2);
  const hy2 = y2 + headLen * Math.sin(a2);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="press-arrow" />
    <polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${hx1.toFixed(1)},${hy1.toFixed(1)} ${hx2.toFixed(1)},${hy2.toFixed(1)}" class="press-arrow" />`;
}

const PLAN_CX = 160;
const PLAN_MAX_W = 190;
const PLAN_MAX_H = 150;
const PLAN_TOP = 78;
const PLAN_STRIP = 14;

// Plan view, wind always drawn from the top regardless of true bearing -- this is a schematic
// "wind hits this face" diagram for the selected axis, not tied to the compass's azimuth.
function buildPlanViewSvg(axis) {
  if (axis.isOpen) return buildOpenPlanViewSvg(axis);
  const b = Math.max(axis.b, 0.1);
  const d = Math.max(axis.d, 0.1);
  const h = Math.max(axis.h, 0.1);
  const scale = Math.min(PLAN_MAX_W / b, PLAN_MAX_H / d);
  const sb = b * scale;
  const sd = d * scale;
  const rectX = PLAN_CX - sb / 2;
  const rectY = PLAN_TOP;

  const windwardRow = governingRowForSurface(axis.wallRows, "Windward wall");
  const leewardRow = governingRowForSurface(axis.wallRows, "Leeward wall");
  const maxAbs = Math.max(...axis.wallRows.map((r) => Math.abs(r.pNet)), 0.01);

  function strip(x, y, w, ht, pNet) {
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${ht.toFixed(1)}" class="${pressureFillClass(pNet)}" fill-opacity="${pressureOpacity(pNet, maxAbs)}" />`;
  }

  let out = `<rect x="${rectX.toFixed(1)}" y="${rectY.toFixed(1)}" width="${sb.toFixed(1)}" height="${sd.toFixed(1)}" class="press-outline" />`;
  out += windArrowSvg(PLAN_CX, 16, PLAN_CX, rectY - 8);
  out += `<text x="${PLAN_CX}" y="12" text-anchor="middle" class="press-arrow-label">Wind</text>`;

  if (windwardRow) {
    out += strip(rectX, rectY, sb, PLAN_STRIP, windwardRow.pNet);
    out += `<text x="${PLAN_CX}" y="${(rectY + PLAN_STRIP / 2 + 3).toFixed(1)}" text-anchor="middle" class="press-label">${fmt(windwardRow.pNet, 2)}</text>`;
  }
  if (leewardRow) {
    const ly = rectY + sd - PLAN_STRIP;
    out += strip(rectX, ly, sb, PLAN_STRIP, leewardRow.pNet);
    out += `<text x="${PLAN_CX}" y="${(ly + PLAN_STRIP / 2 + 3).toFixed(1)}" text-anchor="middle" class="press-label">${fmt(leewardRow.pNet, 2)}</text>`;
  }

  CPE_SIDEWALL_ZONES.forEach((zone) => {
    const row = governingRowForSurface(axis.wallRows, `Side wall, ${zone.label}`);
    if (!row) return;
    const fromM = Math.min(zone.from * h, d);
    const toM = Math.min(zone.to === Infinity ? d : zone.to * h, d);
    if (fromM >= d || toM - fromM < 0.01) return;
    const y1 = rectY + fromM * scale;
    const y2 = rectY + toM * scale;
    out += strip(rectX, y1, PLAN_STRIP, y2 - y1, row.pNet);
    out += strip(rectX + sb - PLAN_STRIP, y1, PLAN_STRIP, y2 - y1, row.pNet);
    if (y2 - y1 > 15) {
      const midY = (y1 + y2) / 2 + 3;
      out += `<text x="${(rectX + PLAN_STRIP / 2).toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" class="press-label press-label-sm">${fmt(row.pNet, 1)}</text>`;
      out += `<text x="${(rectX + sb - PLAN_STRIP / 2).toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" class="press-label press-label-sm">${fmt(row.pNet, 1)}</text>`;
    }
  });

  return out;
}

const ELEV_CX = 170;
const ELEV_BASE_Y = 195;
const ELEV_MAX_W = 200;
const ELEV_MAX_H = 130;

// Elevation (section) along the wind path, wind from the left. For the ridge-normal axes the
// roof line follows the actual gable/hip/monoslope profile; for the ridge-parallel axes a
// gable/monoslope roof doesn't slope in this cut, so it's drawn flat (with a note) -- a hip
// roof's true along-length shape near its ends isn't attempted here, see the isometric view.
function buildElevationSvg(axis) {
  if (axis.isOpen) return buildOpenElevationSvg(axis);
  const d = Math.max(axis.d, 0.1);
  const H = Math.max(axis.h, 0.1);
  const pitchRad = (Math.max(0, Math.min(60, axis.pitch)) * Math.PI) / 180;
  const rows = axis.roofRows;

  function gov(label) {
    return governingRowForSurface(rows, label);
  }

  let roofPts;
  const segments = [];

  if (axis.ridgeTheta !== 0 || axis.pitch < 10) {
    roofPts = [
      { x: 0, y: H },
      { x: d, y: H },
    ];
    CPE_ROOF_LOWPITCH.zones.forEach((zone) => {
      const row = gov(`Roof, ${zone.label}`);
      if (!row) return;
      const fromM = Math.min(zone.from * H, d);
      const toM = Math.min(zone.to === Infinity ? d : zone.to * H, d);
      if (fromM >= d || toM - fromM < 0.01) return;
      segments.push({ x1: fromM, x2: toM, y1: H, y2: H, row });
    });
  } else if (axis.roofType === "monoslope") {
    const rise = d * Math.tan(pitchRad);
    roofPts = [
      { x: 0, y: H },
      { x: d, y: H + rise },
    ];
    const row = gov("Roof, windward (upwind) slope");
    if (row) segments.push({ x1: 0, x2: d, y1: H, y2: H + rise, row });
  } else {
    // gable/hip, pitch >= 10: the along-wind (side) elevation is the same peaked profile for both.
    const rise = (d / 2) * Math.tan(pitchRad);
    roofPts = [
      { x: 0, y: H },
      { x: d / 2, y: H + rise },
      { x: d, y: H },
    ];
    const upRow = gov("Roof, windward (upwind) slope");
    const downRow = gov("Roof, leeward (downwind) slope");
    if (upRow) segments.push({ x1: 0, x2: d / 2, y1: H, y2: H + rise, row: upRow });
    if (downRow) segments.push({ x1: d / 2, x2: d, y1: H + rise, y2: H, row: downRow });
  }

  const maxHeight = Math.max(...roofPts.map((p) => p.y));
  const scale = Math.min(ELEV_MAX_W / d, ELEV_MAX_H / maxHeight);
  const baseX = ELEV_CX - (d * scale) / 2;
  const sx = (xm) => baseX + xm * scale;
  const sy = (ym) => ELEV_BASE_Y - ym * scale;

  const windwardRow = governingRowForSurface(axis.wallRows, "Windward wall");
  const leewardRow = governingRowForSurface(axis.wallRows, "Leeward wall");
  const maxAbs = Math.max(...rows.concat(axis.wallRows).map((r) => Math.abs(r.pNet)), 0.01);

  let out = `<line x1="${(baseX - 20).toFixed(1)}" y1="${ELEV_BASE_Y}" x2="${(baseX + d * scale + 20).toFixed(1)}" y2="${ELEV_BASE_Y}" class="press-ground" />`;

  const arrowY = ELEV_BASE_Y - (maxHeight * scale) / 2;
  out += windArrowSvg(baseX - 45, arrowY, baseX - 12, arrowY);
  out += `<text x="${(baseX - 28).toFixed(1)}" y="${(arrowY - 8).toFixed(1)}" text-anchor="middle" class="press-arrow-label">Wind</text>`;

  const wallW = 12;
  if (windwardRow) {
    const y0 = sy(0);
    const yH = sy(H);
    out += `<rect x="${sx(0).toFixed(1)}" y="${yH.toFixed(1)}" width="${wallW}" height="${(y0 - yH).toFixed(1)}" class="${pressureFillClass(windwardRow.pNet)}" fill-opacity="${pressureOpacity(windwardRow.pNet, maxAbs)}" />`;
    out += `<text x="${(sx(0) + wallW / 2).toFixed(1)}" y="${((y0 + yH) / 2 + 3).toFixed(1)}" text-anchor="middle" class="press-label press-label-sm" transform="rotate(-90 ${(sx(0) + wallW / 2).toFixed(1)} ${((y0 + yH) / 2 + 3).toFixed(1)})">${fmt(windwardRow.pNet, 2)}</text>`;
  }
  const leewardHeight = roofPts[roofPts.length - 1].y;
  if (leewardRow) {
    const y0 = sy(0);
    const yH = sy(leewardHeight);
    out += `<rect x="${(sx(d) - wallW).toFixed(1)}" y="${yH.toFixed(1)}" width="${wallW}" height="${(y0 - yH).toFixed(1)}" class="${pressureFillClass(leewardRow.pNet)}" fill-opacity="${pressureOpacity(leewardRow.pNet, maxAbs)}" />`;
    out += `<text x="${(sx(d) - wallW / 2).toFixed(1)}" y="${((y0 + yH) / 2 + 3).toFixed(1)}" text-anchor="middle" class="press-label press-label-sm" transform="rotate(-90 ${(sx(d) - wallW / 2).toFixed(1)} ${((y0 + yH) / 2 + 3).toFixed(1)})">${fmt(leewardRow.pNet, 2)}</text>`;
  }

  const outlinePts = roofPts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  out += `<polyline points="${outlinePts}" class="press-outline" />`;
  out += `<line x1="${sx(0).toFixed(1)}" y1="${ELEV_BASE_Y}" x2="${sx(0).toFixed(1)}" y2="${sy(H).toFixed(1)}" class="press-outline" />`;
  out += `<line x1="${sx(d).toFixed(1)}" y1="${ELEV_BASE_Y}" x2="${sx(d).toFixed(1)}" y2="${sy(leewardHeight).toFixed(1)}" class="press-outline" />`;

  segments.forEach((seg) => {
    const x1 = sx(seg.x1);
    const y1 = sy(seg.y1);
    const x2 = sx(seg.x2);
    const y2 = sy(seg.y2);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="press-roof-seg ${pressureFillClass(seg.row.pNet)}" stroke-opacity="${pressureOpacity(seg.row.pNet, maxAbs)}" />`;
    if (Math.abs(x2 - x1) > 24 || Math.abs(y2 - y1) > 24) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - 7;
      out += `<text x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" class="press-label press-label-sm">${fmt(seg.row.pNet, 2)}</text>`;
    }
  });

  if (!segments.length && axis.roofUnavailableNote) {
    out += `<text x="${ELEV_CX}" y="${(sy(H) - 12).toFixed(1)}" text-anchor="middle" class="press-note-text">roof C&#8320;,e not available for this direction</text>`;
  } else if (axis.ridgeTheta !== 0 && axis.pitch >= 10) {
    out += `<text x="${ELEV_CX}" y="${(sy(H) - 12).toFixed(1)}" text-anchor="middle" class="press-note-text">roof shown flat -- parallel to ridge</text>`;
  }

  return out;
}

// --- Open building (free roof) variants of the plan/elevation diagrams -------------------------
// There are no walls: the roof is split into the Cp,w / Cp,l halves (or the three distance zones
// of Table B.4(B)) and each band shows its governing (largest-magnitude) net pressure.

function openGovRow(axis, idx) {
  const label = axis.openEntries[idx] && axis.openEntries[idx].label;
  const matches = axis.roofRows.filter((r) => r.entryLabel === label);
  if (!matches.length) return null;
  return matches.reduce((worst, r) => (Math.abs(r.pNet) > Math.abs(worst.pNet) ? r : worst), matches[0]);
}

// Bands along the along-wind depth, in metres from the windward edge.
function openBands(axis) {
  const d = Math.max(axis.d, 0.1);
  const bands = [];
  if (axis.openMode === "zones") {
    const h = Math.max(axis.h, 0.1);
    const edges = [0, Math.min(h, d), Math.min(2 * h, d), d];
    for (let i = 0; i < 3; i++) {
      if (edges[i + 1] - edges[i] > 0.01) bands.push({ x1: edges[i], x2: edges[i + 1], row: openGovRow(axis, i) });
    }
  } else {
    bands.push({ x1: 0, x2: d / 2, row: openGovRow(axis, 0) });
    bands.push({ x1: d / 2, x2: d, row: openGovRow(axis, 1) });
  }
  return bands.filter((bnd) => bnd.row);
}

function buildOpenPlanViewSvg(axis) {
  const b = Math.max(axis.b, 0.1);
  const d = Math.max(axis.d, 0.1);
  const scale = Math.min(PLAN_MAX_W / b, PLAN_MAX_H / d);
  const sb = b * scale;
  const sd = d * scale;
  const rectX = PLAN_CX - sb / 2;
  const rectY = PLAN_TOP;
  const maxAbs = Math.max(...axis.roofRows.map((r) => Math.abs(r.pNet)), 0.01);

  let out = "";
  openBands(axis).forEach((bnd) => {
    const y1 = rectY + bnd.x1 * scale;
    const y2 = rectY + bnd.x2 * scale;
    out += `<rect x="${rectX.toFixed(1)}" y="${y1.toFixed(1)}" width="${sb.toFixed(1)}" height="${(y2 - y1).toFixed(1)}" class="${pressureFillClass(bnd.row.pNet)}" fill-opacity="${pressureOpacity(bnd.row.pNet, maxAbs)}" />`;
    if (y2 - y1 > 12) {
      out += `<text x="${PLAN_CX}" y="${((y1 + y2) / 2 + 3).toFixed(1)}" text-anchor="middle" class="press-label">${fmt(bnd.row.pNet, 2)}</text>`;
    }
  });
  out += `<rect x="${rectX.toFixed(1)}" y="${rectY.toFixed(1)}" width="${sb.toFixed(1)}" height="${sd.toFixed(1)}" class="press-outline" />`;
  // support posts at the four corners
  [[rectX, rectY], [rectX + sb, rectY], [rectX, rectY + sd], [rectX + sb, rectY + sd]].forEach(([px, py]) => {
    out += `<rect x="${(px - 3).toFixed(1)}" y="${(py - 3).toFixed(1)}" width="6" height="6" class="press-outline" />`;
  });
  out += windArrowSvg(PLAN_CX, 16, PLAN_CX, rectY - 8);
  out += `<text x="${PLAN_CX}" y="12" text-anchor="middle" class="press-arrow-label">Wind</text>`;
  return out;
}

function buildOpenElevationSvg(axis) {
  const d = Math.max(axis.d, 0.1);
  const H = Math.max(axis.h, 0.1);
  const pitchRad = (Math.max(0, Math.min(60, axis.pitch)) * Math.PI) / 180;
  const flat = axis.openTheta === 90 || axis.openMode === "zones" && axis.pitch === 0;
  const rise = flat ? 0 : axis.roofType === "monoslope" ? d * Math.tan(pitchRad) : (d / 2) * Math.tan(pitchRad);

  let pts;
  if (flat || rise === 0) {
    pts = [{ x: 0, y: H }, { x: d, y: H }];
  } else if (axis.roofType === "monoslope") {
    pts = axis.openTheta === 180 ? [{ x: 0, y: H + rise }, { x: d, y: H }] : [{ x: 0, y: H }, { x: d, y: H + rise }];
  } else if (axis.roofType === "troughed") {
    pts = [{ x: 0, y: H }, { x: d / 2, y: Math.max(H - rise, H * 0.1) }, { x: d, y: H }];
  } else {
    pts = [{ x: 0, y: H }, { x: d / 2, y: H + rise }, { x: d, y: H }];
  }
  const yAt = (x) => {
    for (let i = 0; i < pts.length - 1; i++) {
      if (x <= pts[i + 1].x + 1e-9) return pts[i].y + ((x - pts[i].x) / (pts[i + 1].x - pts[i].x)) * (pts[i + 1].y - pts[i].y);
    }
    return pts[pts.length - 1].y;
  };

  const maxHeight = Math.max(...pts.map((p) => p.y));
  const scale = Math.min(ELEV_MAX_W / d, ELEV_MAX_H / maxHeight);
  const baseX = ELEV_CX - (d * scale) / 2;
  const sx = (xm) => baseX + xm * scale;
  const sy = (ym) => ELEV_BASE_Y - ym * scale;
  const maxAbs = Math.max(...axis.roofRows.map((r) => Math.abs(r.pNet)), 0.01);

  let out = `<line x1="${(baseX - 20).toFixed(1)}" y1="${ELEV_BASE_Y}" x2="${(baseX + d * scale + 20).toFixed(1)}" y2="${ELEV_BASE_Y}" class="press-ground" />`;
  const arrowY = ELEV_BASE_Y - (maxHeight * scale) / 2;
  out += windArrowSvg(baseX - 45, arrowY, baseX - 12, arrowY);
  out += `<text x="${(baseX - 28).toFixed(1)}" y="${(arrowY - 8).toFixed(1)}" text-anchor="middle" class="press-arrow-label">Wind</text>`;

  // posts + roof outline
  out += `<line x1="${sx(0).toFixed(1)}" y1="${ELEV_BASE_Y}" x2="${sx(0).toFixed(1)}" y2="${sy(yAt(0)).toFixed(1)}" class="press-outline" />`;
  out += `<line x1="${sx(d).toFixed(1)}" y1="${ELEV_BASE_Y}" x2="${sx(d).toFixed(1)}" y2="${sy(yAt(d)).toFixed(1)}" class="press-outline" />`;
  out += `<polyline points="${pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")}" class="press-outline" />`;

  // pressure bands: split each at the profile's vertices so a band never cuts across a ridge/valley
  const verts = pts.map((p) => p.x).filter((x) => x > 0 && x < d);
  openBands(axis).forEach((bnd) => {
    const cuts = [bnd.x1, ...verts.filter((v) => v > bnd.x1 + 1e-9 && v < bnd.x2 - 1e-9), bnd.x2];
    for (let i = 0; i < cuts.length - 1; i++) {
      const x1 = sx(cuts[i]);
      const y1 = sy(yAt(cuts[i]));
      const x2 = sx(cuts[i + 1]);
      const y2 = sy(yAt(cuts[i + 1]));
      out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="press-roof-seg ${pressureFillClass(bnd.row.pNet)}" stroke-opacity="${pressureOpacity(bnd.row.pNet, maxAbs)}" />`;
    }
    const midX = sx((bnd.x1 + bnd.x2) / 2);
    const midY = sy(yAt((bnd.x1 + bnd.x2) / 2)) - 7;
    if ((bnd.x2 - bnd.x1) * scale > 24) {
      out += `<text x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" class="press-label press-label-sm">${fmt(bnd.row.pNet, 2)}</text>`;
    }
  });

  if (!axis.roofRows.length) {
    out += `<text x="${ELEV_CX}" y="${(sy(H) - 12).toFixed(1)}" text-anchor="middle" class="press-note-text">roof C&#8320;,n not available for this roof type</text>`;
  } else if (axis.openTheta === 90) {
    out += `<text x="${ELEV_CX}" y="${(sy(H) - 24).toFixed(1)}" text-anchor="middle" class="press-note-text">roof shown flat -- parallel to ridge</text>`;
  }
  return out;
}

function populatePressureDiagramAxis() {
  const sel = $("pressureDiagramAxis");
  const labels = ["θ=0° (front)", "θ=90°", "θ=180°", "θ=270°"];
  labels.forEach((label, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = label;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", renderPressureDiagrams);
}

function renderPressureDiagrams() {
  if (!lastAxisResults) return;
  const idx = parseInt($("pressureDiagramAxis").value, 10) || 0;
  const axis = lastAxisResults[idx];
  if (!axis) return;

  $("planViewSvg").innerHTML = buildPlanViewSvg(axis);
  $("elevationViewSvg").innerHTML = buildElevationSvg(axis);

  const caseText = axis.isOpen
    ? `Open building: the roof is shown in its C<sub>p,w</sub> / C<sub>p,l</sub> bands (windward edge at the top of the plan, left of the
      elevation). Where a band has two C<sub>p,n</sub> values (a downward and an uplift case), the more extreme one is shown here; both
      are still listed in the tables above.`
    : `Where a surface has more than one load case (Clause 5.4.1 turbulence, or multiple C<sub>p,i</sub> values), the more extreme one
      is shown here; both are still listed in the tables above.`;
  $("pressureDiagramCaption").innerHTML = `Plan and elevation for <strong>${axis.label}</strong>
    (bearing ${fmt(axis.bearing, 0)}&deg;, V<sub>des,&theta;</sub> = ${fmt(axis.Vdes, 1)} m/s). Colour intensity scales with
    |p<sub>net</sub>| within this view only (not a scale shared between directions). ${caseText}
    Schematic only, not to scale, and not linked to the compass's bearing.`;
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
  // An open building's footprint is dashed (roof on posts, no walls); it uses the same ridge line.
  rectEl.style.strokeDasharray = type.glyph === "open" ? "6 4" : "";
  if ((type.glyph === "rect" || type.glyph === "open") && roofType !== "monoslope") {
    if (roofType === "gable" || roofType === "troughed") {
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
  } else if (roofType === "troughed") {
    // Not reachable from the UI (troughed is only offered for open buildings); drawn flat if it is.
    polys.push({ pts: [D, C, C2, D2], cls: "iso-wall" });
    polys.push({ pts: [B, C, C2, B2], cls: "iso-wall-alt" });
    polys.push({ pts: [A2, B2, C2, D2], cls: "iso-roof" });
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

// An open building (free roof): four corner posts carrying a roof plane, with no walls. The
// roof is drawn far slope first, then near slope, so the near slope correctly overpaints it.
function buildIsoOpenRoof(hw, hl, H, pitchRad, roofType) {
  const A = { x: -hw, y: -hl, z: 0 };
  const B = { x: hw, y: -hl, z: 0 };
  const C = { x: hw, y: hl, z: 0 };
  const D = { x: -hw, y: hl, z: 0 };
  const L = (p1, p2) => ({ p1, p2, cls: "iso-lattice" });
  const polys = [];
  let postTops; // [A, B, C, D] roof heights at each post

  if (roofType === "monoslope") {
    const rise = 2 * hl * Math.tan(pitchRad);
    const A2 = { x: -hw, y: -hl, z: H };
    const B2 = { x: hw, y: -hl, z: H };
    const C2 = { x: hw, y: hl, z: H + rise };
    const D2 = { x: -hw, y: hl, z: H + rise };
    polys.push({ pts: [A2, B2, C2, D2], cls: "iso-roof" });
    postTops = [A2, B2, C2, D2];
  } else {
    const trough = roofType === "troughed";
    const rise = hl * Math.tan(pitchRad);
    const mid = trough ? Math.max(H - rise, H * 0.1) : H + rise;
    const A2 = { x: -hw, y: -hl, z: H };
    const B2 = { x: hw, y: -hl, z: H };
    const C2 = { x: hw, y: hl, z: H };
    const D2 = { x: -hw, y: hl, z: H };
    const R1 = { x: -hw, y: 0, z: mid };
    const R2 = { x: hw, y: 0, z: mid };
    polys.push({ pts: [A2, B2, R2, R1], cls: "iso-roof-alt" }); // far slope
    polys.push({ pts: [D2, C2, R2, R1], cls: "iso-roof" }); // near slope
    postTops = [A2, B2, C2, D2];
  }

  const lines = [L(A, postTops[0]), L(B, postTops[1]), L(C, postTops[2]), L(D, postTops[3])];
  return { polys, lines };
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
  } else if (type.glyph === "open") {
    shape = buildIsoOpenRoof(hw, hl, H, pitchRad, roofType);
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
// Print / save-as-PDF report
//
// The page is printed through the browser's own print dialog ("Save as PDF"), styled by the
// @media print rules in style.css: input controls are hidden, a table of the inputs used is added
// at the top, every collapsed results panel is opened, and plan/elevation diagrams are added for
// all four directions (on screen only the selected direction is drawn).
// ---------------------------------------------------------------------------

function selectedText(id) {
  const el = $(id);
  const opt = el && el.selectedOptions && el.selectedOptions[0];
  return opt ? opt.textContent.trim() : "";
}

function buildPrintSummary(errorMessage) {
  const type = BUILDING_TYPES.find((t) => t.id === $("buildingType").value);
  const isOpen = !!type && type.id === "open";
  const num = (id, dp = 1) => fmt(parseFloat($(id).value) || 0, dp);
  const table = (pairs) =>
    `<table><tbody>${pairs.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;

  const mtMode = $("mtMode").value;
  let topography = "Flat / no local topographic feature (M<sub>t</sub> = 1.0)";
  if (mtMode === "manual") {
    topography = `Manual: M<sub>t</sub> = ${num("mtManual", 2)}`;
  } else if (mtMode === "hill") {
    topography = `${selectedText("mhType")}: H = ${num("mhH")} m, L<sub>u</sub> = ${num("mhLu")} m, x = ${num("mhX")} m${
      $("mhA0").checked ? ", Region A0" : ""
    }`;
  }
  const sRaw = $("shieldingS").value;
  const ari = readAriYears();

  // The dropdown marks medium-confidence region matches with a trailing "*"; spell that out in the report.
  let location = selectedText("siteLocation") || "not selected";
  if (/\*$/.test(location)) {
    location = `${location.replace(/\s*\*$/, "")} (medium-confidence region match &mdash; verify against Figure 3.1)`;
  }
  const siteRows = [
    ["Site location", location],
    ["Region (Table 3.1)", selectedText("region")],
    ["Importance level", selectedText("importanceLevel") || "not selected"],
    ["Average recurrence interval, R", `${ari} years`],
    ["Terrain category", selectedText("terrainCategory")],
    ["Shielding parameter, s", sRaw === "" ? "none (M<sub>s</sub> = 1.0)" : sRaw],
    ["Site topography", topography],
  ];
  const buildingRows = [
    ["Building type", type ? `${type.label} (${type.clause})` : ""],
    ["Width, W = b (across wind)", `${num("bldB")} m`],
    ["Length, L = d (along wind)", `${num("bldD")} m`],
    ["Average roof height, h", `${num("bldH")} m`],
    ["Roof type / pitch", `${selectedText("roofType")}, ${num("roofPitch", 0)}&deg;`],
    ["Bearing of θ=0° axis from true North", `${selectedText("azimuth")}`],
    ["Dynamic response factor, C<sub>dyn</sub>", num("pCdyn", 2)],
    isOpen
      ? ["Blockage under roof", `${num("blockedPct", 0)}%`]
      : ["Internal pressure case (Table 5.1(A))", selectedText("cpiCase")],
  ];

  return `
    <div class="print-summary">
      <h2>Wind action calculation &mdash; AS/NZS 1170.2:2021</h2>
      <p class="print-meta">Generated ${new Date().toLocaleString()}. Preliminary / educational tool &mdash; verify against the Standard and have
        results checked by a suitably qualified engineer.</p>
      ${errorMessage ? `<div class="warning">${errorMessage}</div>` : ""}
      <div class="print-cols">
        <div><h3>Site &amp; design criteria</h3>${table(siteRows)}</div>
        <div><h3>Building</h3>${table(buildingRows)}</div>
      </div>
    </div>`;
}

function buildPrintDiagrams() {
  if (!lastAxisResults) return "";
  const blocks = lastAxisResults
    .map(
      (axis) => `
      <div class="print-axis">
        <h4>${axis.label} &mdash; bearing ${fmt(axis.bearing, 0)}°, V<sub>des,θ</sub> = ${fmt(axis.Vdes, 1)} m/s</h4>
        <div class="print-axis-svgs">
          <svg viewBox="0 0 320 300" role="img" aria-label="Plan view for ${axis.label}">${buildPlanViewSvg(axis)}</svg>
          <svg viewBox="0 0 320 240" role="img" aria-label="Elevation view for ${axis.label}">${buildElevationSvg(axis)}</svg>
        </div>
      </div>`
    )
    .join("");
  return `
    <div class="results">
      <h3>Plan &amp; elevation pressure diagrams &mdash; all directions</h3>
      ${blocks}
      <p class="note">Plan: wind from the top. Elevation: wind from the left. Colour intensity scales with |p<sub>net</sub>| within each
        view only; where a surface has more than one load case the more extreme one is shown (all are listed in the tables). Schematic only,
        not to scale.</p>
    </div>`;
}

let lastPrintPrepared = 0;
let titleBeforePrint = null;

function preparePrintReport() {
  // Print can trigger this twice (button click, then the browser's own beforeprint event).
  if (Date.now() - lastPrintPrepared < 1500) return;
  lastPrintPrepared = Date.now();

  const type = BUILDING_TYPES.find((t) => t.id === $("buildingType").value);
  const supported = !type || type.supported;
  let errorMessage = "";

  // Recalculate from the current inputs so the report can never show stale numbers.
  try {
    runSpeedCalc();
    if (supported) {
      renderPressureResults();
    } else {
      $("pressureResults").hidden = true;
      $("pressureDiagrams").hidden = true;
      lastAxisResults = null;
    }
  } catch (err) {
    errorMessage = `The results could not be recalculated for this report (${err && err.message ? err.message : err}). Check the inputs.`;
  }

  $("printSummary").innerHTML = buildPrintSummary(errorMessage);
  $("printAllDiagrams").innerHTML = supported && !errorMessage ? buildPrintDiagrams() : "";

  // Collapsed <details> content isn't printed, so open every results panel.
  document.querySelectorAll("#speedResults details, #pressureResults details").forEach((d) => {
    d.open = true;
  });

  // Browsers use the page title as the suggested PDF file name.
  if (titleBeforePrint === null) titleBeforePrint = document.title;
  const place = selectedText("siteLocation") || selectedText("region");
  document.title = `Wind actions AS1170.2 - ${place || "site"} - ${type ? type.label : "building"}`.replace(/[\\/:*?"<>|]/g, "");
}

function wirePrintReport() {
  $("printReport").addEventListener("click", () => {
    preparePrintReport();
    window.print();
  });
  window.addEventListener("beforeprint", preparePrintReport);
  window.addEventListener("afterprint", () => {
    if (titleBeforePrint !== null) {
      document.title = titleBeforePrint;
      titleBeforePrint = null;
    }
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  populateRegions();
  populateLocations();
  populateAzimuth();
  populateBuildingTypes();
  populateAri();
  populateImportanceLevels();
  populateRoofTypes();
  populateBuildingSizes();
  populateCpiCases();
  populatePressureDiagramAxis();
  wireTopographyControls();
  wireCompass();
  renderDiagrams();

  $("calcSpeeds").addEventListener("click", runSpeedCalc);
  $("calcPressure").addEventListener("click", renderPressureResults);
  wirePrintReport();
});
