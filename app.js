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
  const z = parseFloat($("refHeight").value) || 0;
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
    <p class="note">Copy the governing V<sub>des,θ</sub> value into Section&nbsp;2 below to calculate design wind pressures.</p>
  `;

  // auto-fill pressure section with the governing (max) Vdes
  const maxVdes = Math.max(...designResults.map((d) => d.Vdes));
  $("pVdes").value = maxVdes.toFixed(1);
  $("bldH").value = z;
}

function runSpeedCalc() {
  const regionKey = $("region").value;
  const R = readAriYears();
  const terrainCategory = parseFloat($("terrainCategory").value);
  const z = parseFloat($("refHeight").value) || 0;
  const h = z; // reference height used consistently as average roof height for Ms applicability
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
  const Vdes = parseFloat($("pVdes").value) || 0;
  const Cdyn = parseFloat($("pCdyn").value) || 1.0;
  const b = parseFloat($("bldB").value) || 1;
  const d = parseFloat($("bldD").value) || 1;
  const h = parseFloat($("bldH").value) || 1;
  const pitch = parseFloat($("roofPitch").value) || 0;
  const theta = parseInt($("windTheta").value, 10);
  const db = d / b;
  const hd = h / d;

  const cpiCase = CPI_CASES.find((c) => c.id === $("cpiCase").value);
  const cpeWw = cpeWindwardWall(h);
  const cpeLw = cpeLeewardWall({ theta, pitch, db });
  const leewardTableMinDb = theta === 90 || pitch < 10 ? 1 : pitch >= 25 ? 0.1 : null;
  const leewardTableMaxDb = theta === 90 || pitch < 10 ? 4 : pitch >= 25 ? 0.3 : null;
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

  el.innerHTML = `
    <div class="pill">d/b = ${fmt(db, 2)}</div>
    <div class="pill">h/d = ${fmt(hd, 2)}</div>
    <div class="pill">C<sub>p,i</sub> case: ${cpiLabel}</div>
    ${dbNote}
    ${pitchNote}
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
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  populateRegions();
  populateLocations();
  populateAri();
  populateCpiCases();
  wireTopographyControls();

  $("calcSpeeds").addEventListener("click", runSpeedCalc);
  $("calcPressure").addEventListener("click", renderPressureResults);
});
