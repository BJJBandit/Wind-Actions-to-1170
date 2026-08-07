# Wind Actions to AS/NZS 1170.2:2021 (basic calculator)

A static, client-side calculator that automates the tedious table look-ups in **AS/NZS 1170.2:2021 –
Structural design actions, Part 2: Wind actions**: site wind speed, design wind speed, and a
preliminary design wind pressure for enclosed rectangular buildings. No build step, no dependencies —
open `index.html` or serve the folder statically (e.g. GitHub Pages).

**This is a preliminary/educational tool, not a substitute for the Standard or for engineering
judgement.** Always verify results against AS/NZS 1170.2:2021 directly and have designs checked by a
suitably qualified engineer.

## What's implemented

**Section 2 — Calculation of wind actions**
- Site wind speed `Vsit,β` (Equation 2.2) for all 8 cardinal directions
- Design wind speed `Vdes,θ` (Clause 2.3) for 4 orthogonal building axes, with the building's bearing
  adjustable, using true linear interpolation of the ±45° sector (not just nearest-cardinal)
- Design wind pressure (Equation 2.4(1))

**Section 3 — Regional wind speeds**
- Regional wind speed `VR` (Table 3.1(A)/(B)) for all AU regions (A0–A5, B1, B2, C, D) and NZ regions
  (NZ1–NZ4), using the tabulated values for standard ARIs and the closed-form formula for other R ≥ 5
  years
- Wind direction multiplier `Md` (Table 3.2(A)/(B))
- Climate change multiplier `Mc` (Table 3.3)
- An optional **site location dropdown** (capital cities + major regional centres, AU + NZ) that
  pre-fills the Region field. See "Site location dropdown" below — it's an assistive shortcut, not an
  authoritative region lookup, and remains fully editable.

**Section 4 — Site exposure multipliers**
- Terrain/height multiplier `Mz,cat` (Table 4.1), including the Region A0 special case (constant 1.24)
- Shielding multiplier `Ms` (Table 4.2) — enter the shielding parameter `s` directly; `Ms` is forced to
  1.0 for h > 25 m per Clause 4.3.1
- Topographic multiplier `Mt` / hill-shape multiplier `Mh` (Clause 4.4), including Region A0's
  `Mt = 0.5 + 0.5Mh` and the >500 m AMSL case `Mt = Mh·Mlee·(1+0.00015E)`

**Section 5 — Aerodynamic shape factor (enclosed rectangular buildings only)**
- Wall external pressure coefficients `Cp,e`: windward (Table 5.2(A)), leeward (Table 5.2(B), by
  roof pitch and d/b), side walls (Table 5.2(C), by distance from windward edge)
- Roof external pressure coefficients for **pitch < 10° only** (Table 5.3(A)), by h/d and zone
- Internal pressure coefficient `Cp,i` cases from Table 5.1(A) (small-opening/impermeable-roof cases)
- Net pressure `p = 0.5 × ρ_air × Vdes,θ² × Cshp × Cdyn` (Equation 2.4(1))

## Site location dropdown

AS/NZS 1170.2:2021 defines wind regions by the maps in Figures 3.1(A) (Australia) and 3.1(B) (New
Zealand) — there's no official list mapping place names to regions. The dropdown in `data.js`
(`LOCATIONS`) was compiled two ways, and each entry is tagged accordingly:

- **High confidence** — the town name and a region label appear together, unambiguously, in the
  Standard's own map figure text (e.g. `SYDNEY Region A2`, `Region B1 BRISBANE`, `Wyndham (C)` all
  appear as direct pairs when the PDF is text-extracted).
- **Medium confidence** (marked `*` in the dropdown) — inferred from nearby map-text clustering plus
  general engineering/public knowledge (e.g. Australia's cyclonic northern coastline), without a direct
  same-label pairing. Treat these as a starting point, particularly for:
  - the **A0–A5 sub-region split**, which is new in the 2021 edition and the least reliably
    extractable part of the map text (though note `VR` and `Mc` are identical across A0–A5, so the
    consequence of picking the wrong A-subregion is limited to `Md`, not the headline wind speed —
    the higher-stakes call is cyclonic vs non-cyclonic and A0 vs non-A0, both handled with more
    confidence), and
  - anywhere close to a region boundary (e.g. the new B2/C boundary through central-north Queensland,
    or B2/D through the WA Pilbara).

Selecting a location only pre-fills the Region dropdown — it stays fully editable, and every selection
shows the reasoning and a prompt to confirm against Figure 3.1 for anything but the high-confidence
entries.

## What's deliberately out of scope

To avoid presenting numbers with false confidence, the following are **not** automated:

- **Section 6 (dynamic response)** — `Cdyn` is a manual input (default 1.0). Wind-sensitive structures
  (tall/slender buildings, poles, masts, natural frequency < 1 Hz, etc.) require the full Section 6
  procedure, which is not implemented.
- **Appendices A–E** — circular bins/silos/tanks, freestanding walls/hoardings/canopies, exposed
  members/lattice towers, flags/circular shapes, and accelerations/rotational velocities.
- **Ka, Kc, Kl, Kp** (area reduction, action combination, local pressure, porous cladding factors) are
  all taken as 1.0. These matter for cladding/fixing design — apply them separately per Clauses
  5.4.2–5.4.5.
- **Pitched roofs ≥ 10°** (Tables 5.3(B)/(C)) — the source table has gaps for h/d ≥ 1.0 that aren't
  safe to guess at, and the full table is a 2D lookup on pitch × h/d that wasn't reliably extractable.
  Source `Cp,e` from the Standard directly and compute the pressure by hand for these roofs.
  Low-pitch roofs (< 10°) are fully covered.
- **Regions C/D coastal-distance interpolation** (Clause 3.2) — only the tabulated *maximum* values are
  offered; the Standard's distance-based interpolation depends on the regional maps (Figure 3.1) which
  aren't reproducible here. Using the maximum value is conservative.
- **NZ lee-zone multiplier `Mlee`** (Clause 4.4.3, Table 4.4) — left at 1.0. If your NZ site is in one
  of the 17 identified lee zones, apply `Mlee` manually.
- **Shielding parameter `s` from geometry** (Equations 4.3(1)/4.3(2)) — the source formula didn't
  extract cleanly from the PDF and a wrong formula could silently produce unconservative pressures, so
  it's safer to require `s` as a direct input than to guess at the equation.
- **Terrain averaging across changing upwind terrain** (Clause 4.2.3) — a single terrain category is
  assumed to apply for the full averaging distance.

## Usage

1. Open `index.html` in a browser (or visit the GitHub Pages URL if enabled for this repo).
2. **Section 1** — pick region, ARI, terrain category, reference height, and optional shielding /
   topography inputs, then **Calculate wind speeds**. This gives `Vsit,β` for all 8 directions and
   `Vdes,θ` for the 4 building axes.
3. **Section 2** — the governing `Vdes,θ` and reference height carry over automatically; fill in
   building plan dimensions, roof pitch, wind direction relative to the ridge, and an internal pressure
   case, then **Calculate wind pressures** for windward/leeward/side wall and (pitch < 10°) roof zones.

## Hosting on GitHub Pages

Repo Settings → Pages → Deploy from a branch → `main` / `/ (root)`. No build step required — it's
plain HTML/CSS/JS.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure / form |
| `style.css` | Styling |
| `data.js` | Tables transcribed from AS/NZS 1170.2:2021, with clause/table references |
| `calc.js` | Calculation engine (pure functions, no DOM access) |
| `app.js` | Wires the form to the calculation engine and renders results |

## License

No license has been set for this repository. All rights reserved by the repository owner unless a
license is added.
