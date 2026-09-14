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
- Calculates wall and roof pressures for **all 4 building orthogonal axes** (Clause 2.5.2's minimum) in
  one go, each priced with its own governing `Vdes,θ` from Section 2 — not just a single hand-picked
  direction. A summary line calls out the governing (largest-magnitude) wall and roof pressure across
  all four.
- Wall external pressure coefficients `Cp,e`: windward (Table 5.2(A)), leeward (Table 5.2(B), by
  roof pitch and d/b), side walls (Table 5.2(C), by distance from windward edge) — computed per axis,
  with `d/b` swapped for the two side axes since it's always relative to the current wind direction
- **Roof pressures for every pitch up to 45°** when wind is normal to the ridge (the front/back axes):
  Table 5.3(A) below 10°, Tables 5.3(B) (windward/upwind slope) and 5.3(C) (leeward/downwind slope, and
  a hip roof's hip-end slopes) at 10–45°. For pitch ≥ 10° with wind parallel to the ridge (the side
  axes), Tables 5.3(B)/(C) don't tabulate the crosswind case, so that axis is flagged rather than guessed.
- **Roof type** (gable / hip / monoslope): applied where AS/NZS 1170.2 requires the distinction —
  Table 5.2(B) Note 3 sends a hip roof's leeward wall to the θ = 0° values at every wind direction, and
  a hip roof's hip-end (R) slopes use the same Table 5.3(C) value as the downwind slope (Clause
  5.4.1(c)). The compass diagram draws the ridge (and hip lines) accordingly, and the isometric view
  redraws the whole roof form.
- Internal pressure coefficient `Cp,i` cases from Table 5.1(A) (small-opening/impermeable-roof cases)
- **Permeable cladding reduction factor `Kp`** (Clause 5.4.5, Table 5.8) — see "Permeable cladding
  reduction factor" below
- Net pressure `p = 0.5 × ρ_air × Vdes,θ² × Cshp × Cdyn` (Equation 2.4(1))
- A **plan and elevation pressure diagram** (direction picked from a dropdown) that redraws from the
  same per-axis results — see "Plan & elevation pressure diagrams" below.

## Permeable cladding reduction factor (Kp)

A "Roof / side wall cladding" selector in the Building section switches between standard/impermeable
(`Kp = 1.0`, the default) and permeable cladding with a 0.1–1% open-area ratio, which lets `Kp` be
taken from Table 5.8 for **negative (suction) pressure only** — a positive `Cp,e` is never reduced, and
neither are the windward/leeward walls, since Clause 5.4.5 only covers roofs and side walls.

Table 5.8's zones are fractions of `da` (the along-wind depth of the surface) — a different basis than
the existing `h`-multiple zones used for `Cp,e` (Table 5.2(C) for side walls, Table 5.3(A) for low-pitch
roofs). Rather than re-zone every surface to match, each existing `Cp,e` zone gets a single representative
`Kp`, looked up at that zone's own midpoint distance from the windward edge, expressed as a fraction of
`da`. For the pitch ≥ 10° upwind/downwind roof slopes (Tables 5.3(B)/(C)), which aren't already
sub-divided into zones, the windward half of the plan depth stands in for the upwind (and a hip roof's
hip-end) slope and the leeward half for the downwind slope — a coarser approximation than the fine
zoning Table 5.8 assumes, and flagged as such in the results. A `Kp` column in the pressure tables shows
the value used for every row (1.00 where it doesn't apply); the `Cp,e` column always shows the
Standard's raw tabulated value, not the `Kp`-reduced one, so the tables stay traceable back to source.

## Plan & elevation pressure diagrams

Below the pressure tables, a direction dropdown drives two schematic SVG views built from the same
per-axis results Section 3 already computed (no recalculation on dropdown change):

- **Plan** — the footprint from above, wind drawn from the top. Windward/leeward strips run across the
  top/bottom edges; the side walls are split into their real zones (0–1h, 1h–2h, 2h–3h, >3h from the
  windward edge), clipped to however much of each zone actually fits within the building's depth.
- **Elevation** — a section cut along the wind path, wind from the left. Wall strips at each end; the
  roof line follows the actual gable/hip/monoslope profile when wind is normal to the ridge, or is drawn
  flat (with a note) when wind is parallel to the ridge, since a gable/monoslope roof doesn't slope in
  that cut.

Both use colour (the same pos/neg palette as the results tables) with opacity scaled to `|p_net|`
*within that view only* — it is not a scale shared between directions, so don't compare colour intensity
across two different dropdown selections. Where a surface has more than one load case (Clause 5.4.1
turbulence, or more than one `Cp,i` value), the diagram shows whichever is more extreme; both stay listed
in the tables above. These are schematic and not to scale, and — unlike the compass/isometric views in
Section 1 — not linked to the building's true bearing; they always draw wind from a fixed direction (top
for plan, left for elevation) for the axis currently selected.

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

## Building type dropdown

AS/NZS 1170.2:2021 covers five broad categories of structure, in Section 5 and Appendices A–D. This
tool only calculates the first:

| Building type | Where it's covered | Calculated here? |
|---|---|---|
| Enclosed rectangular building | Section 5 | Yes (walls fully, roof pitch < 10° only) |
| Circular bins, silos and tanks | Appendix A | No |
| Freestanding walls, hoardings, canopies and roofs | Appendix B | No |
| Exposed structural members, frames and lattice towers | Appendix C | No |
| Flags and circular shapes | Appendix D | No |

Selecting one of the unsupported types disables the Section 3 calculation (with a notice pointing at
the right Appendix) rather than silently producing nothing or, worse, a wrong number — Section 2's site
and design wind speed calculation is unaffected either way, since it's independent of building type.

## Building importance level dropdown

This is an AS/NZS 1170.0 / National Construction Code (NCC) concept, not part of AS/NZS 1170.2 itself —
1170.2 only supplies wind speeds for a given average recurrence interval (ARI); it's 1170.0/the NCC that
assigns an importance level to a structure and, from that, the ARI to design for. The R values offered
(IL1→100, IL2→500, IL3→1000, IL4→2000 years) are the commonly-published ULS defaults for a **50-year
design working life**, not read from a specific NCC edition in this session. Defaults to **IL2** on load,
so the ARI field already reflects it (R = 500 years) without needing to touch this dropdown. Selecting
one pre-fills the ARI field in Section 2 (still fully editable) with a prompt to confirm:

- the importance level classification itself against the current NCC's criteria for the actual building,
- the exact R value against the current NCC/AS 1170.0 edition, particularly for a design working life
  other than 50 years, and
- that serviceability limit state design uses a separate, shorter ARI (commonly 20–25 years) which this
  selector does not set.

A fifth option, **"Other"**, covers structures that don't fit IL1–4 (a temporary structure, a
performance-based assessment, a design working life other than 50 years) — it deliberately doesn't
suggest an ARI; it leaves whatever R is already set and prompts picking one directly in the ARI dropdown.

## Isometric view

Next to the compass, a schematic isometric drawing redraws itself from the same building type, roof
type/pitch, and W × L × h inputs — a box with a gable/hip/monoslope roof for enclosed buildings, a
cylinder for circular bins/silos/tanks and flags/circular shapes, a thin panel for freestanding
walls/hoardings/canopies, and an open cross-braced frame for exposed members/lattice towers.

It uses a **fixed camera angle** rather than rotating with the building's bearing. That's deliberate:
with a fixed camera the set of visible/hidden faces never changes, so which face is drawn on top of
which can be hard-coded per shape — a camera that rotated with azimuth would need genuine hidden-surface
removal to stay correct at every angle, which is a lot of additional risk for a decorative diagram. It's
schematic only (not to engineering scale, no shadows/lighting beyond flat per-face tints for legibility).

## What's deliberately out of scope

To avoid presenting numbers with false confidence, the following are **not** automated:

- **Section 6 (dynamic response)** — `Cdyn` is a manual input (default 1.0). Wind-sensitive structures
  (tall/slender buildings, poles, masts, natural frequency < 1 Hz, etc.) require the full Section 6
  procedure, which is not implemented.
- **Appendices A–E** — circular bins/silos/tanks, freestanding walls/hoardings/canopies, exposed
  members/lattice towers, flags/circular shapes, and accelerations/rotational velocities.
- **Ka, Kc, Kl** (area reduction, action combination, local pressure factors) are all taken as 1.0.
  These matter for cladding/fixing design — apply them separately per Clauses 5.4.2–5.4.4.
  **Kp (permeable cladding reduction factor, Clause 5.4.5/Table 5.8)** *is* calculated — see below.
- **Pitched roofs ≥ 10° with wind parallel to the ridge** (the two "side" building axes) — Tables
  5.3(B)/(C) only tabulate the upwind/downwind case (wind normal to the ridge, the "front/back" axes),
  which is what's calculated. The crosswind case isn't given a simple table in Section 5; source
  `Cp,e` from the Standard directly for that axis. Every other pitch/direction combination up to 45° is
  calculated (Tables 5.3(A)/(B)/(C)).
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
2. **Section 1 (Building)** — pick the building type (only "Enclosed rectangular building" is actually
   calculated — see below) and, optionally, an importance level to suggest an ARI; then set the
   building's plan size (W × L, or pick a preset), average roof height, roof type/pitch, and bearing
   (drag the compass or use the dropdown). These feed both sections below.
3. **Section 2 (Site wind speed)** — pick region, ARI, terrain category, and optional shielding /
   topography inputs, then **Calculate wind speeds**. This gives `Vsit,β` for all 8 directions and
   `Vdes,θ` for the 4 building axes.
4. **Section 3 (Design wind pressure)** — set `Cdyn` and an internal pressure case, then **Calculate
   wind pressures**. Computes windward/leeward/side wall and roof pressures for **all 4 building axes**,
   each priced with its own `Vdes,θ` from Section 2 — no need to pick a single direction — with a
   summary line calling out the governing (largest-magnitude) wall and roof pressure.

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
