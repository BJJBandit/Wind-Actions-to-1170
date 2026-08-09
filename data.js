/*
 * Data tables extracted from AS/NZS 1170.2:2021 "Structural design actions -- Part 2: Wind actions".
 * Section/table/clause references are noted alongside each table so results can be checked
 * against the printed Standard. This file contains ONLY the data; calculations live in calc.js.
 */

// ---------------------------------------------------------------------------
// Section 3 -- Regional wind speeds
// ---------------------------------------------------------------------------

// Table 3.1(A) -- Regional wind speeds (m/s) -- Australia
// Columns: 'A' = Region A(0-5); 'B1_B2' = Regions B1 & B2 (identical values);
// 'C_max' = Region C maximum; 'D_max' = Region D maximum.
const VR_TABLE_AU = {
  1: { A: 30, B1_B2: 26, C_max: 23, D_max: 23 },
  5: { A: 32, B1_B2: 28, C_max: 33, D_max: 35 },
  10: { A: 34, B1_B2: 33, C_max: 39, D_max: 43 },
  20: { A: 37, B1_B2: 38, C_max: 45, D_max: 51 },
  25: { A: 37, B1_B2: 39, C_max: 47, D_max: 53 },
  50: { A: 39, B1_B2: 44, C_max: 52, D_max: 60 },
  100: { A: 41, B1_B2: 48, C_max: 56, D_max: 66 },
  200: { A: 43, B1_B2: 52, C_max: 61, D_max: 72 },
  250: { A: 43, B1_B2: 53, C_max: 62, D_max: 74 },
  500: { A: 45, B1_B2: 57, C_max: 66, D_max: 80 },
  1000: { A: 46, B1_B2: 60, C_max: 70, D_max: 85 },
  2000: { A: 48, B1_B2: 63, C_max: 73, D_max: 90 },
  2500: { A: 48, B1_B2: 64, C_max: 74, D_max: 91 },
  5000: { A: 50, B1_B2: 67, C_max: 78, D_max: 95 },
  10000: { A: 51, B1_B2: 69, C_max: 81, D_max: 99 },
};

// VR (R >= 5 years) formulae, Table 3.1(A). NOTE 2: V1 is NOT given by the formula for AU regions.
const VR_FORMULA_AU = {
  A: (R) => 67 - 41 * Math.pow(R, -0.1),
  B1_B2: (R) => 106 - 92 * Math.pow(R, -0.1),
  C_max: (R) => 122 - 104 * Math.pow(R, -0.1),
  D_max: (R) => 156 - 142 * Math.pow(R, -0.1),
};

// Table 3.1(B) -- Regional wind speeds (m/s) -- New Zealand
const VR_TABLE_NZ = {
  1: { NZ1_2: 31, NZ3: 37, NZ4: 38 },
  5: { NZ1_2: 35, NZ3: 42, NZ4: 42 },
  10: { NZ1_2: 37, NZ3: 44, NZ4: 43 },
  20: { NZ1_2: 39, NZ3: 46, NZ4: 44 },
  25: { NZ1_2: 39, NZ3: 46, NZ4: 45 },
  50: { NZ1_2: 41, NZ3: 48, NZ4: 46 },
  100: { NZ1_2: 42, NZ3: 50, NZ4: 47 },
  200: { NZ1_2: 43, NZ3: 51, NZ4: 48 },
  250: { NZ1_2: 44, NZ3: 51, NZ4: 49 },
  500: { NZ1_2: 45, NZ3: 53, NZ4: 50 },
  1000: { NZ1_2: 46, NZ3: 54, NZ4: 50 },
  2000: { NZ1_2: 47, NZ3: 55, NZ4: 51 },
  2500: { NZ1_2: 47, NZ3: 55, NZ4: 52 },
  5000: { NZ1_2: 48, NZ3: 56, NZ4: 52 },
  10000: { NZ1_2: 49, NZ3: 57, NZ4: 53 },
};

const VR_FORMULA_NZ = {
  NZ1_2: (R) => 61 - 30 * Math.pow(R, -0.1),
  NZ3: (R) => 71 - 34 * Math.pow(R, -0.1),
  NZ4: (R) => 63 - 25 * Math.pow(R, -0.1),
};

// Region metadata: which VR column, Md column and Mc value each named region uses.
// Table 3.3 -- Climate change multiplier (Mc)
const REGIONS = {
  A0: { country: "AU", vrCol: "A", mdCol: "A0", mc: 1.0, label: "inland non-synoptic / downdraft dominant" },
  A1: { country: "AU", vrCol: "A", mdCol: "A1", mc: 1.0, label: "extra-tropical synoptic winds dominant" },
  A2: { country: "AU", vrCol: "A", mdCol: "A2", mc: 1.0, label: "mixed synoptic / non-synoptic winds" },
  A3: { country: "AU", vrCol: "A", mdCol: "A3", mc: 1.0, label: "mixed synoptic / non-synoptic winds" },
  A4: { country: "AU", vrCol: "A", mdCol: "A4", mc: 1.0, label: "extra-tropical synoptic winds dominant" },
  A5: { country: "AU", vrCol: "A", mdCol: "A5", mc: 1.0, label: "mixed synoptic / non-synoptic winds" },
  B1: { country: "AU", vrCol: "B1_B2", mdCol: "B1", mc: 1.0, label: "mixed synoptic incl. tropical cyclones" },
  B2: { country: "AU", vrCol: "B1_B2", mdCol: "B2CD", mc: 1.05, label: "cyclonic, tropical cyclones dominant" },
  C: { country: "AU", vrCol: "C_max", mdCol: "B2CD", mc: 1.05, label: "cyclonic (maximum value; interpolate by coastal distance per Cl 3.2)" },
  D: { country: "AU", vrCol: "D_max", mdCol: "B2CD", mc: 1.05, label: "cyclonic (maximum value; interpolate by coastal distance per Cl 3.2)" },
  NZ1: { country: "NZ", vrCol: "NZ1_2", mdCol: "NZ1", mc: 1.0, label: "extra-tropical synoptic winds dominant" },
  NZ2: { country: "NZ", vrCol: "NZ1_2", mdCol: "NZ2", mc: 1.0, label: "extra-tropical synoptic winds dominant" },
  NZ3: { country: "NZ", vrCol: "NZ3", mdCol: "NZ3", mc: 1.0, label: "extra-tropical synoptic winds dominant" },
  NZ4: { country: "NZ", vrCol: "NZ4", mdCol: "NZ4", mc: 1.0, label: "extra-tropical synoptic winds dominant" },
};

// Cardinal direction order used throughout (matches Figure 2.2, clockwise from North)
const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const CARDINAL_ANGLES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

// Table 3.2(A) -- Wind direction multiplier (Md) -- Australia
const MD_AU = {
  A0: [0.9, 0.85, 0.85, 0.9, 0.9, 0.95, 1.0, 0.95],
  A1: [0.9, 0.85, 0.85, 0.8, 0.8, 0.95, 1.0, 0.95],
  A2: [0.85, 0.75, 0.85, 0.95, 0.95, 0.95, 1.0, 0.95],
  A3: [0.9, 0.75, 0.75, 0.9, 0.9, 0.95, 1.0, 0.95],
  A4: [0.85, 0.75, 0.75, 0.8, 0.8, 0.9, 1.0, 1.0],
  A5: [0.95, 0.8, 0.8, 0.8, 0.8, 0.95, 1.0, 0.95],
  B1: [0.75, 0.75, 0.85, 0.9, 0.95, 0.95, 0.95, 0.9],
  B2CD: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
};

// Table 3.2(B) -- Wind direction multiplier (Md) -- New Zealand
const MD_NZ = {
  NZ1: [0.9, 0.95, 0.95, 0.95, 0.9, 1.0, 1.0, 0.95],
  NZ2: [0.95, 0.9, 0.8, 0.9, 0.95, 1.0, 1.0, 1.0],
  NZ3: [1.0, 0.75, 0.75, 0.85, 0.95, 0.95, 0.9, 1.0],
  NZ4: [0.95, 0.75, 0.75, 0.75, 0.85, 0.95, 1.0, 1.0],
};

// ---------------------------------------------------------------------------
// Section 4 -- Site exposure multipliers
// ---------------------------------------------------------------------------

// Table 4.1 -- Terrain/height multipliers (Mz,cat) for fully developed terrain, all regions except A0
const MZCAT_HEIGHTS = [3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200];
const MZCAT_TABLE = {
  1: [0.97, 1.01, 1.08, 1.12, 1.14, 1.18, 1.21, 1.23, 1.27, 1.31, 1.36, 1.39],
  2: [0.91, 0.91, 1.0, 1.05, 1.08, 1.12, 1.16, 1.18, 1.22, 1.24, 1.27, 1.29],
  2.5: [0.87, 0.87, 0.92, 0.97, 1.01, 1.06, 1.1, 1.13, 1.17, 1.2, 1.24, 1.27],
  3: [0.83, 0.83, 0.83, 0.89, 0.94, 1.0, 1.04, 1.07, 1.12, 1.16, 1.21, 1.24],
  4: [0.75, 0.75, 0.75, 0.75, 0.75, 0.8, 0.85, 0.9, 0.98, 1.03, 1.11, 1.16],
};
// NOTE 1 to Table 4.1: Region A0 uses a constant Mz,cat = 1.24 for z <= 200 m, all terrains.
const MZCAT_A0_CONSTANT = 1.24;

// Table 4.2 -- Shielding multiplier (Ms), for h <= 25 m
const MS_TABLE = {
  s: [1.5, 3.0, 6.0, 12.0],
  Ms: [0.7, 0.8, 0.9, 1.0],
};

// ---------------------------------------------------------------------------
// Section 5 -- Aerodynamic shape factor (enclosed rectangular buildings only)
// ---------------------------------------------------------------------------

const AIR_DENSITY = 1.2; // kg/m3, Clause 2.4.1

// Table 5.1(A) -- Internal pressure coefficient (Cp,i) cases (small/no openings, impermeable roof)
const CPI_CASES = [
  { id: "ww_permeable", label: "(a) Windward wall permeable, others impermeable", cpi: "cpe_ww", note: "Cp,i = Cp,e of the windward wall" },
  { id: "ww_impermeable", label: "(b) Windward wall impermeable, one other wall permeable", cpi: [-0.3] },
  { id: "two_three_ww_permeable", label: "Two or three walls permeable incl. windward wall", cpi: [-0.1, 0.2] },
  { id: "two_three_ww_impermeable", label: "Two or three walls permeable, windward wall impermeable", cpi: [-0.3] },
  { id: "all_permeable", label: "All walls permeable", cpi: [-0.3, 0.0] },
  { id: "sealed", label: "Effectively sealed building, non-opening windows", cpi: [-0.2, 0.0] },
];

// Table 5.2(B) -- Leeward wall Cp,e, wind normal to ridge (theta = 0 deg), hip or gable roof.
// d/b interpolation points for roof pitch < 10 deg (independent of pitch), by d/b = 1, 2, 4.
const CPE_LEEWARD_THETA0_LOWPITCH = { db: [1, 2, 4], cpe: [-0.5, -0.3, -0.2] };
// Fixed values (independent of d/b) for pitch 10-20 deg, theta = 0
const CPE_LEEWARD_THETA0_BY_PITCH = { 10: -0.3, 15: -0.3, 20: -0.4 };
// Pitch >= 25 deg, theta = 0: depends on d/b (only two points given in the Standard)
const CPE_LEEWARD_THETA0_PITCH25 = { db: [0.1, 0.3], cpe: [-0.75, -0.5] };
// theta = 90 deg (wind parallel to ridge), gable roof, any pitch: same as low-pitch d/b table above
const CPE_LEEWARD_THETA90 = CPE_LEEWARD_THETA0_LOWPITCH;

// Table 5.2(C) -- Side wall Cp,e by horizontal distance from windward edge (in multiples of h)
const CPE_SIDEWALL_ZONES = [
  { from: 0, to: 1, cpe: -0.65, label: "0 to 1h from windward edge" },
  { from: 1, to: 2, cpe: -0.5, label: "1h to 2h from windward edge" },
  { from: 2, to: 3, cpe: -0.3, label: "2h to 3h from windward edge" },
  { from: 3, to: Infinity, cpe: -0.2, label: "> 3h from windward edge" },
];

// Table 5.3(A) -- Roof Cp,e for roof pitch < 10 deg (upwind/downwind/crosswind slopes), by h/d and zone
// Each zone gives [more-negative, less-negative] values -- both must be checked (Clause 5.4.1).
// Values shown as `null` are not tabulated in the Standard for that h/d ratio (the printed table only
// gives an interpolation value at 1h-2h and marks the 2h-3h / >3h, h/d=1.0 cells "see Note" with no
// figure supplied) -- the calculator refuses to guess these and asks the user to consult AS/NZS 1170.2
// Table 5.3(A) directly for that zone.
const CPE_ROOF_LOWPITCH = {
  hd: [0.5, 1.0],
  zones: [
    { from: 0, to: 0.5, label: "0 to 0.5h", values: { 0.5: [-0.9, -0.4], 1.0: [-1.3, -0.6] } },
    { from: 0.5, to: 1, label: "0.5h to 1h", values: { 0.5: [-0.9, -0.4], 1.0: [-0.7, -0.3] } },
    { from: 1, to: 2, label: "1h to 2h", values: { 0.5: [-0.5, 0.0], 1.0: [-0.7, -0.3] } },
    { from: 2, to: 3, label: "2h to 3h", values: { 0.5: [-0.3, 0.1], 1.0: null } },
    { from: 3, to: Infinity, label: "> 3h", values: { 0.5: [-0.2, 0.2], 1.0: null } },
  ],
};

// ---------------------------------------------------------------------------
// Site location -> wind region lookup (assistive, not authoritative)
// ---------------------------------------------------------------------------
//
// AS/NZS 1170.2:2021 defines wind regions by the maps in Figures 3.1(A) (Australia) and
// 3.1(B) (New Zealand), not by any list of place names. There is no substitute for reading
// those maps at your actual site, especially near a region boundary.
//
// This list was built two ways:
//  - "high" confidence: the town name and a region label sit together, unambiguously, in the
//    Standard's own map figure text (e.g. "SYDNEY Region A2", "Region B1 BRISBANE",
//    "Wyndham (C)" all appear as direct pairs in Figure 3.1(A)).
//  - "medium" confidence: inferred from a combination of nearby map-text clustering and
//    well-established general engineering/public knowledge (e.g. Australia's cyclonic
//    northern coastline is common knowledge independent of this specific Standard), but
//    without a direct same-label pairing in the extracted map text. Treat these as a
//    starting point only, particularly for the A0-A5 sub-region split (new in the 2021
//    edition, and least reliably extractable from the map text) and any location close to a
//    region boundary.
//
// Selecting a location only pre-fills the Region dropdown above -- it can still be changed
// manually, and should be checked against Figure 3.1 for anything but the "high" confidence
// entries.
const LOCATIONS = [
  // ---- Australia ----
  { name: "Sydney, NSW", region: "A2", confidence: "high", note: "Directly labelled \"SYDNEY Region A2\" on Figure 3.1(A)." },
  { name: "Wollongong, NSW", region: "A2", confidence: "high", note: "Adjacent to Sydney on the same labelled coastal stretch." },
  { name: "Newcastle, NSW", region: "A2", confidence: "medium", note: "Inferred from the NSW coastal cluster near Sydney; confirm against Figure 3.1(A)." },
  { name: "Canberra, ACT", region: "A3", confidence: "high", note: "Directly labelled \"CANBERRA A3\" on Figure 3.1(A)." },
  { name: "Wagga Wagga, NSW", region: "A3", confidence: "medium", note: "Inferred from the inland-NSW A3 cluster on Figure 3.1(A)." },
  { name: "Tamworth, NSW", region: "A3", confidence: "medium", note: "Inferred from the inland-NSW A3 cluster on Figure 3.1(A)." },

  { name: "Brisbane, QLD", region: "B1", confidence: "high", note: "Directly labelled \"Region B1 BRISBANE\" on Figure 3.1(A)." },
  { name: "Gold Coast, QLD", region: "B1", confidence: "medium", note: "Adjacent to Brisbane; confirm against Figure 3.1(A), especially near the NSW border." },
  { name: "Sunshine Coast, QLD", region: "B1", confidence: "medium", note: "Adjacent to Brisbane on Figure 3.1(A); confirm boundary distance." },
  { name: "Toowoomba, QLD", region: "A0", confidence: "medium", note: "Appears near the Region A0 label on Figure 3.1(A); this is an inland/elevated boundary area -- confirm." },
  { name: "Bundaberg, QLD", region: "B2", confidence: "medium", note: "Central QLD coast cyclonic zone; boundary with B1 -- confirm against Figure 3.1(A)." },
  { name: "Gladstone, QLD", region: "B2", confidence: "medium", note: "Central QLD coast cyclonic zone; confirm against Figure 3.1(A)." },
  { name: "Rockhampton, QLD", region: "B2", confidence: "medium", note: "Near the \"Region B2 Biloela\" label on Figure 3.1(A) (Biloela is a nearby inland town)." },
  { name: "Mackay, QLD", region: "B2", confidence: "medium", note: "Central QLD coast cyclonic zone; confirm against Figure 3.1(A)." },
  { name: "Townsville, QLD", region: "C", confidence: "medium", note: "Historically Region C; sits near the new B2/C boundary introduced in 2021 -- confirm." },
  { name: "Cairns, QLD", region: "C", confidence: "high", note: "Clustered directly with \"Region C\" labels on Figure 3.1(A); well-established cyclonic region." },
  { name: "Mount Isa, QLD", region: "A0", confidence: "medium", note: "Inland arid interior; inferred non-synoptic/downdraft zone -- confirm against Figure 3.1(A)." },

  { name: "Darwin, NT", region: "C", confidence: "high", note: "Clustered directly with \"Region C\" labels on Figure 3.1(A); well-established cyclonic region." },
  { name: "Nhulunbuy, NT", region: "B2", confidence: "medium", note: "Labelled near \"Region B2\" on Figure 3.1(A)." },
  { name: "Alice Springs, NT", region: "A0", confidence: "medium", note: "Inland arid interior; inferred non-synoptic/downdraft zone -- confirm against Figure 3.1(A)." },
  { name: "Tennant Creek, NT", region: "A0", confidence: "medium", note: "Inland arid interior; inferred non-synoptic/downdraft zone -- confirm against Figure 3.1(A)." },

  { name: "Perth, WA", region: "A1", confidence: "high", note: "Directly labelled near \"PERTH ... Region A1\" on Figure 3.1(A)." },
  { name: "Esperance, WA", region: "A1", confidence: "high", note: "Directly labelled alongside Perth's \"Region A1\" on Figure 3.1(A)." },
  { name: "Albany, WA", region: "A1", confidence: "medium", note: "Adjacent to the Perth/Esperance A1 cluster on Figure 3.1(A)." },
  { name: "Bunbury, WA", region: "A1", confidence: "medium", note: "South-west WA coast, near Perth's A1 zone -- confirm." },
  { name: "Geraldton, WA", region: "B2", confidence: "medium", note: "Directly near a \"Region B2\" label on Figure 3.1(A), just north of the A1 zone -- confirm, this is close to a boundary." },
  { name: "Kalgoorlie, WA", region: "A1", confidence: "medium", note: "Inland WA; inferred from proximity to the A1 zone on Figure 3.1(A) -- confirm." },
  { name: "Broome, WA", region: "C", confidence: "high", note: "Clustered directly with \"Region C\" labels on Figure 3.1(A); well-established cyclonic region." },
  { name: "Port Hedland, WA", region: "B2", confidence: "medium", note: "Figure 3.1(A) map text places a \"B2\" label directly by Port Hedland -- but this is a severe-cyclone area, confirm carefully against Figure 3.1(A) / Table 3.1(A) Region D." },
  { name: "Karratha, WA", region: "D", confidence: "medium", note: "Near the \"Region D\" label on Figure 3.1(A); one of the most severe cyclonic areas in Australia -- confirm." },
  { name: "Exmouth, WA", region: "D", confidence: "medium", note: "Near the \"Region D\" label on Figure 3.1(A); one of the most severe cyclonic areas in Australia -- confirm." },

  { name: "Adelaide, SA", region: "A2", confidence: "medium", note: "No direct map-text label found; assumed consistent with other southern temperate capitals -- confirm against Figure 3.1(A)." },
  { name: "Ceduna, SA", region: "A5", confidence: "high", note: "Directly labelled \"Region A5 Ceduna\" on Figure 3.1(A)." },
  { name: "Port Augusta, SA", region: "A3", confidence: "medium", note: "Inferred from the inland A3 cluster on Figure 3.1(A)." },
  { name: "Mount Gambier, SA", region: "A2", confidence: "medium", note: "No direct map-text label found; low confidence -- confirm against Figure 3.1(A)." },

  { name: "Melbourne, VIC", region: "A4", confidence: "medium", note: "Inferred from the \"Region A4\" label near Ballarat/Geelong on Figure 3.1(A); confirm." },
  { name: "Geelong, VIC", region: "A4", confidence: "medium", note: "Near the \"Region A4\" label on Figure 3.1(A)." },
  { name: "Ballarat, VIC", region: "A4", confidence: "medium", note: "Near the \"Region A4\" label on Figure 3.1(A)." },
  { name: "Bendigo, VIC", region: "A4", confidence: "medium", note: "Near the \"Region A4\" cluster on Figure 3.1(A); low-medium confidence -- confirm." },
  { name: "Mildura, VIC", region: "A3", confidence: "medium", note: "Inferred from the inland A3 cluster on Figure 3.1(A)." },
  { name: "Sale, VIC", region: "A4", confidence: "medium", note: "Near the \"Region A4\" label on Figure 3.1(A)." },

  { name: "Hobart, TAS", region: "A4", confidence: "medium", note: "Near the \"Region A4\" cluster on Figure 3.1(A); confirm -- Tasmania-wide sub-region boundaries are not clearly extractable." },
  { name: "Launceston, TAS", region: "A4", confidence: "medium", note: "Near the \"Region A4\" cluster on Figure 3.1(A); confirm." },

  // ---- New Zealand ----
  { name: "Auckland, NZ", region: "NZ1", confidence: "high", note: "Directly labelled near \"REGION NZ1\" on Figure 3.1(B)." },
  { name: "Hamilton, NZ", region: "NZ1", confidence: "medium", note: "Near the Auckland NZ1 cluster on Figure 3.1(B)." },
  { name: "New Plymouth, NZ", region: "NZ1", confidence: "medium", note: "West coast North Island; confirm against Figure 3.1(B), close to the NZ1/NZ2 boundary." },
  { name: "Rotorua, NZ", region: "NZ2", confidence: "high", note: "Directly labelled \"Rotorua REGION NZ2\" on Figure 3.1(B)." },
  { name: "Wellington, NZ", region: "NZ3", confidence: "medium", note: "Not directly labelled in the extracted map text, but NZ3 has the highest tabulated wind speeds in Table 3.1(B) and Wellington/Cook Strait is well known for extreme wind -- confirm against Figure 3.1(B)." },
  { name: "Blenheim, NZ", region: "NZ3", confidence: "medium", note: "Top of South Island near Cook Strait; confirm against Figure 3.1(B), could be NZ2." },
  { name: "Christchurch, NZ", region: "NZ2", confidence: "high", note: "Directly labelled \"Christchurch REGION NZ2\" on Figure 3.1(B)." },
  { name: "Dunedin, NZ", region: "NZ2", confidence: "medium", note: "South Island; no direct label found -- confirm against Figure 3.1(B)." },
  { name: "Invercargill, NZ", region: "NZ2", confidence: "medium", note: "South Island; no direct label found -- confirm against Figure 3.1(B)." },
];

// ---------------------------------------------------------------------------
// Building size presets (Section 2) -- illustrative footprints only, not
// sourced from the Standard. W = width (b, across-wind), L = length (d, along-wind).
// ---------------------------------------------------------------------------
const BUILDING_SIZES = [
  { name: "Domestic garage/carport (W6 x L6 m)", w: 6, l: 6 },
  { name: "Small shed (W6 x L9 m)", w: 6, l: 9 },
  { name: "Single dwelling (W10 x L15 m)", w: 10, l: 15 },
  { name: "Large house/duplex (W15 x L20 m)", w: 15, l: 20 },
  { name: "Rural shed (W9 x L12 m)", w: 9, l: 12 },
  { name: "Farm shed (W15 x L24 m)", w: 15, l: 24 },
  { name: "Machinery shed (W20 x L30 m)", w: 20, l: 30 },
  { name: "Small commercial/warehouse (W20 x L40 m)", w: 20, l: 40 },
  { name: "Medium warehouse (W30 x L50 m)", w: 30, l: 50 },
  { name: "Large industrial warehouse (W40 x L60 m)", w: 40, l: 60 },
  { name: "Distribution centre (W60 x L100 m)", w: 60, l: 100 },
];
