# Parameter verification: powerlifting scoring coefficients (Wilks, Wilks2020, DOTS, IPF GL)

Scope: `packages/rules/data/scoring.yaml` rows `scoring.wilks.coefficients`, `scoring.wilks2020.coefficients`, `scoring.dots.coefficients` and `scoring.ipfGl.coefficients`. These are currently `verified: false` and sourced only from OpenPowerlifting (OPL) code. This note checks every registry coefficient against the most authoritative non-OPL document I could open. It also reproduces the EB unit-test vectors and the worked examples printed in the sources. Research only: no registry or code changes were made.

Method: each document was downloaded (PDF/HTML) on 2026-11-25. Coefficients were extracted from the text layer, the PDF render or the embedded calculator equation, and compared with the registry YAML strings by exact decimal equality in a Python script (`Decimal(registry) == Decimal(source)`; trailing zeros such as `0.009210` vs `0.00921` count as equal). Where a source prints only a coefficient table, every table cell was recomputed from the registry polynomial and rounded half-up to the printed precision.

## Summary

| Set | Best source found (opened) | Coefficients | Proposed verdict | Confidence |
|---|---|---|---|---|
| IPF GL | IPF 2020, *The IPF GL Coefficients for Relative Scoring* (primary, IPF) | 24/24 match | **Verify** | high |
| DOTS | Konertz 2019, *Die DOTS-Formeln – Die neuen Wilks* (author's own publication) | 10/10 match | **Verify** | high |
| Wilks2020 | Powerlifting Australia 2020 announcement + PA "Wilks Formula" page (equation and 0.05 kg tables); same on World Powerlifting's "Official Wilks Formula" page | 12/12 match; 5,440/5,440 table cells match | **Verify** | high |
| Wilks (1995) | IPF-hosted Kopayev et al. 2020 report (Appendix 1 prints the polynomial) + Robert Wilks' coefficient tables (EPF-hosted PDF) | 12/12 match; table 2,761/2,770 cells exact, 9 off by 1 in the 4th decimal at rounding half-points | **Verify** (no Wilks-authored polynomial found) | high for the values, medium for primacy |

No coefficient needs correcting. Side findings that need a decision:

1. **IPF GL lower bodyweight bound.** The IPF document states the formula applies for `Bwt ≥ 40 kg for men and Bwt ≥ 35 kg for women`. The registry row `scoring.ipfGl.minBodyweightKg` is 35 kg for both sexes, which follows OPL.
2. **IPF GL rounding.** The IPF procedure rounds the coefficient to 6 decimals before multiplying, then rounds the points to 6 decimals. General score sheets show 3 decimals. For the men's equipped example this gives 112.855365 points (112.86 at 2 dp). The unrounded coefficient gives 112.854854 (112.85 at 2 dp, which is the EB test vector). At 3 dp both give 112.855.
3. The IPF GL document is titled "actual from May 01, 2020 to Dec 31, 2023". No later coefficient set was found: the IPF formula page still serves this document, and the IPF Technical Rules Book 2026 prints no coefficients.

## 1. IPF GL

### Primary source (opened)
- **International Powerlifting Federation (2020). *The IPF GL Coefficients for Relative Scoring — actual from May 01, 2020 to Dec 31, 2023*.** Dated "May 2020" on the cover; PDF metadata title `IPF(GL)_Coefficients-2020-v.0.6.5_eng`, created 2020-04-17. https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf. It is linked from the IPF formula page https://www.powerlifting.sport/rules/codes/info/ipf-formula (opened), which also links:
  - the announcement https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Announcement_IPF_GL_Formula_2020_1_.pdf (opened). It says the GL points are valid from 1 May 2020 at all IPF-sanctioned events and were developed by O. Kopayev, B. Onyshchenko and A. Stetsenko;
  - the IPF competition spreadsheet https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Championships-IPF-GL.xlsm (opened as a zip archive; no macros run). Its sheet 3 holds the same eight A/B/C triples;
  - the Models Evaluation report (see §5), whose Appendix 1 also prints the eight GL triples.

### Formula as printed
`IPF GL Points = IPF GL Coefficient × Result` (0 if Result = 0). `IPF GL Coefficient = 100 / (A − B·e^(−C·Bwt))`, "body weight Bwt ≥ 40 kg for men and Bwt ≥ 35 kg for women". This is the same form as the registry.

### Table 1 vs registry (all digits)

| Sex | Event | A (doc) | B (doc) | C (doc) | Registry |
|---|---|---|---|---|---|
| Men | Equipped Powerlifting | 1236.25115 | 1449.21864 | 0.01644 | identical |
| Men | Classic Powerlifting | 1199.72839 | 1025.18162 | 0.00921 | identical (registry writes 0.009210) |
| Men | Equipped Bench Press | 381.22073 | 733.79378 | 0.02398 | identical |
| Men | Classic Bench Press | 320.98041 | 281.40258 | 0.01008 | identical |
| Women | Equipped Powerlifting | 758.63878 | 949.31382 | 0.02435 | identical |
| Women | Classic Powerlifting | 610.32796 | 1045.59282 | 0.03048 | identical |
| Women | Equipped Bench Press | 221.82209 | 357.00377 | 0.02937 | identical |
| Women | Classic Bench Press | 142.40398 | 442.52671 | 0.04724 | identical |

The same 24 numbers appear in the IPF spreadsheet (stored as binary floats, e.g. `1025.1816200000001`) and in the Models Evaluation report, Appendix 1 §5.

### Worked examples printed in the document (recomputed with registry coefficients)
- Men's equipped powerlifting, Inzarkin (RUS), 92.04 kg, 1035.0 kg. Document: `0.109039 × 1035.0 = 112.855365`. Recomputed: coefficient 0.109038506, which rounds to 0.109039 at 6 dp, and 0.109039 × 1035 = **112.855365**, an exact match. With the unrounded coefficient the points are 112.854854, which rounds to 112.85 at 2 dp (the EB vector).
- Women's classic bench, Torronen (FIN), 70.50 kg, 122.5 kg. Document: `0.790069 × 122.5 = 96.783453`. Recomputed: coefficient 0.790068984, which rounds to 0.790069, and 0.790069 × 122.5 = **96.783453**, an exact match. Unrounded: 96.783451, which rounds to 96.78 (the EB vector).

### Other statements in the document
- Rounding procedure: "equalization coefficients are calculated according to Formula 2 … Rounding is performed with an accuracy of 6 decimal places. This value is multiplied by the value of the result … and then round this value up to 6 decimal places." Coefficients are shown to 6 dp. Points are shown to 3 dp on general score sheets and to 6 dp on detailed sheets.
- The coefficients are meant to be re-estimated on a four-year cycle. The cover gives the validity window 1 May 2020 to 31 Dec 2023. As of 2026-11-25 I found no successor set: the IPF formula page links only the 2020 files, and the IPF Technical Rules Books 2016, 2020 and 2026 that I opened refer to "IPF formula/IPF points" without printing any coefficients.

### Bodyweight bound
The document states `Bwt ≥ 40 kg` (men) and `Bwt ≥ 35 kg` (women). It does not say what happens below these bounds. The registry `scoring.ipfGl.minBodyweightKg = 35` (both sexes, following OPL) therefore differs for men. That row is verified as an app choice, so this is only reported here.

**Verdict: Verify `scoring.ipfGl.coefficients` against the IPF 2020 GL document. Confidence high.** The registry note "official GL model document could not be opened; only men's classic is independently confirmed" and the `src.opl-goodlift` note are now outdated. `src.vcalc-ipf-gl` is no longer needed.

## 2. DOTS

### Primary source (opened)
- **Konertz T (2019). *Die DOTS-Formeln – Die neuen Wilks*.** Kraftsport Colonia website (Cologne club). Published 2019-10-15 (page metadata `datePublished` 2019-10-15T14:25:40Z, modified 2019-10-15T14:33:32Z). https://kraftsport-colonia.de/dots. The page is signed by Tim Konertz and is the author's own publication of the formula; German Wikipedia's article "DOTS-Relativwertung" cites it as reference 1. The formula is printed twice: as images (`maenner.png`, `frauen.png`, viewed) and in "Excel-Form":
  - Men, `Definitionsbereich D = (40; 210)`: `=500/(-0,0000010930*Bw^4+0,0007391293*Bw^3-0,1918759221*Bw^2+24,0900756*Bw-307,75076)`
  - Women, `D = (40;150)`: `=500/(-0,0000010706*Bw^4+0,0005158568*Bw^3-0,1126655495*Bw^2+13,6175032*Bw-57,96288)`
  - "Koeffizienten außerhalb des Definitionsbereiches entsprechen dem Koeffizienten der Grenze zum Definitionsbereich" (outside the domain, the coefficient at the domain boundary applies).
- The page also describes the derivation, but only qualitatively: a 4th-degree polynomial with no inflection point in the domain, fitted to IPF World Championship and World Games data (raw and equipped, total and single lifts), with performance bands weighted by performance density and anchored to world records. It also says the name comes from the German Bundesliga team-scoring use: "Dynamisch Objektives Teamwertungs System". There is no technical report with the fitting data.

### Comparison (registry ascending E, D, C, B, A)
| | E | D | C | B | A |
|---|---|---|---|---|---|
| Men (Konertz) | -307,75076 | 24,0900756 | -0,1918759221 | 0,0007391293 | -0,0000010930 |
| Men (registry) | -307.75076 | 24.0900756 | -0.1918759221 | 0.0007391293 | -0.000001093 |
| Women (Konertz) | -57,96288 | 13,6175032 | -0,1126655495 | 0,0005158568 | -0,0000010706 |
| Women (registry) | -57.96288 | 13.6175032 | -0.1126655495 | 0.0005158568 | -0.0000010706 |

All 10 coefficients match; the only difference is the decimal comma and a trailing zero. The IPF-hosted Kopayev et al. 2020 report (§5) prints the same 10 values.

### Bodyweight clamps
The author's domain and boundary rule (men 40–210 kg, women 40–150 kg, boundary coefficient outside) is exactly the registry `scoring.dots.bodyweightClampKg`. So the clamp is the author's rule, not only an OPL choice.

### Federation adoption (BVDK): not opened
German Wikipedia cites a BVDK decision "DOTS-Punkte für Mannschaftswettkämpfe ab 2020" at https://bvdk.de/dots-punkte-f%C3%BCr-mannschaftswettk%C3%A4mpfe-ab-2020 and a BVDK committee-meeting news item. Both URLs now return HTTP 404. The current bvdk.de site has no DOTS page I could find, and the Internet Archive was "Temporarily Offline" during this session. **I could not open any BVDK document**, so BVDK adoption is unverified here. It does not affect the coefficients, which come from the author.

**Verdict: Verify `scoring.dots.coefficients` against Konertz 2019, with the Kopayev et al. 2020 IPF report as corroboration. Confidence high.** The registry note "No official derivation of DOTS exists" should be softened. Suggested wording: "Defined by its author (Konertz 2019); the derivation is described only qualitatively, with no technical report."

## 3. Wilks2020 ("Wilks Formula 2")

### Sources (all opened)
- **Powerlifting Australia (2020-02-28). *Wilks Formula 2 Released*.** News post. https://powerliftingaustralia.com/2020/02/28/wilks-formula-2-released/ (the URL cited by Wikipedia, .../news/2020/02/wilks-formula-2-released/, redirects here). Text: "The legendary WIlks Formula … has been updated for 2020 onwards. New data has allowed for a rebalancing of coefficients, with Men and Womens performances better aligned and the extreme bodyweght classes brought into better balance with the middle bodyweight classes." It prints no coefficients. It points to the calculator at worldpowerlifting.com and to the tables at https://powerliftingaustralia.com/wilks-formula/, and lists recalibrated top-2019 scores. **It does not name Robert Wilks as author**, so the attribution to Robert Wilks is still secondary (Wikipedia).
- **Powerlifting Australia. *Wilks Formula — Rate Your Performance*** (undated page). https://powerliftingaustralia.com/wilks-formula/. It embeds the calculator equation `fieldname6*600/((Male?47.4617885411949:-125.425539779509)+(Male?8.47206137941125:13.7121941940668)*BW+(Male?0.073694103462609:-0.0330725063103405)*BW^2+(Male?-0.00139583381094385:-0.0010504000506583)*BW^3+(Male?0.00000707665973070743:0.00000938773881462799)*BW^4+(Male?-0.0000000120804336482315:-0.000000023334613884954)*BW^5)`. It also has manual coefficient tables in 0.05 kg steps: women 40.00–150.95 kg (2,220 cells) and men 40.00–200.95 kg (3,220 cells).
- **World Powerlifting. *Wilks Calculator 2020 — Official Wilks Formula*** (undated page). https://worldpowerlifting.com/technical/wilks-formula-calculator/. It has the same embedded equation with numerator 600 and the same two tables. Text: "The Wilks 2020 Formula replaces the old Wilks Formula of 1995 and is much more accurate." It does not name the formula's author.
- Corroboration: the IPF-hosted Kopayev et al. 2020 report (§5), Appendix 1 "Wilks-2 Formula", prints the same 12 coefficients with numerator 600.

### Comparison
All 12 coefficients in both calculator equations and in the IPF report are digit-for-digit identical to the registry. Numerator 600 is confirmed. Recomputing every table cell from the registry polynomial (rounded half-up to 4 dp) reproduces **5,440/5,440 cells** on both PA and WP (women 2,220/2,220, men 3,220/3,220).

### Test vectors and printed examples
- EB coefficient vectors, all reproduced at 4 dp:
  - Men: 40 → 1.3895, 60 → 0.9968, 80 → 0.8191, 100 → 0.7294, 120 → 0.6817, 140 → 0.6546, 200 → 0.6123 (computed 1.389530, 0.996837, 0.819138, 0.729362, 0.681725, 0.654563, 0.612317).
  - Women: 40 → 1.8486, 60 → 1.3190, 80 → 1.1318, 100 → 1.0525, 150 → 0.9635 (computed 1.848635, 1.319033, 1.131776, 1.052453, 0.963480).
- PA page: Reinmuth 967 kg at 166.0 kg = "610 points" (computed 610.48); Craven 427 kg at 52.5 kg = "619 points" (computed 619.85). Both are consistent, since the page prints whole points.
- PA/WP: "69.45 kg male lifter has a coefficient of .8971" reproduces (0.8971). The WP page's product ".8971 × 520 kg = 466.44" is an arithmetic slip on the page: 0.8971 × 520 = 466.49.
- WP: Tongotea 533 kg at 71.80 kg = 633.55 reproduces (633.5459). Wierzbicki 897 kg at 97.10 kg = 661.46 does **not** reproduce: the computed value is 662.94. 661.46 would need a coefficient of 0.737414, which corresponds to about 97.57 kg. The same page's own equation and table give 662.94, so the inconsistency is in that example's bodyweight or points figure, not in the coefficients.

### Bodyweight clamps
The published tables span exactly 40–200.95 kg (men) and 40–150.95 kg (women), which equals the registry `scoring.wilks2020.bodyweightClampKg`. The pages give no explicit rule for values outside the tables.

**Verdict: Verify `scoring.wilks2020.coefficients` against Powerlifting Australia 2020 (announcement plus formula page), with World Powerlifting and Kopayev et al. 2020 as corroboration. Confidence high.** Keep the note that attribution to Robert Wilks is secondary.

## 4. Wilks (original, 1995)

### What a primary source would be, and what exists
- **IPF Technical Rules Book**: I opened the IPF-hosted 2016 edition in two uploads: https://www.powerlifting.sport/fileadmin/ipf/data/rules/technical-rules/english/IPF_Technical_Rules_Book_2016.pdf (PDF created 2015-12-10) and .../IPF_Technical_Rules_Book_2016__1_.pdf (2016-01-02). Both only say that best lifter and team ties are decided on "Wilks points/the Wilks formula", plus a "Wilks formula/Wilks points" field on the score sheet. **They print no coefficients.** The 2017 and 2018 editions are not on the IPF server at the usual URLs (404), and the Internet Archive was offline, so I could not check them. The premise that pre-2019 IPF rulebooks printed the coefficients is not supported by the 2016 edition.
- No document by Robert Wilks that prints the polynomial coefficients was found. Vanderburgh & Batterham 1999 (*Med Sci Sports Exerc* 31(12):1869–75, doi:10.1097/00005768-199912000-00027) validated the formula but was not opened.

### Best sources found (opened)
- **Kopayev O, Onyshchenko B, Stetsenko A (2020). *Report: Evaluation of Wilks, Wilks-2, DOTS, IPF and GoodLift formulas for calculating relative scores in IPF powerlifting competitions*** (March 2020), hosted by the IPF. https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Models_Evaluation-I-2020_01.pdf. This is the file linked from the IPF formula page; this upload's PDF was created 2024-12-30, and the title page says March 2020. Appendix 1 §1 "Wilks Formula": `Wilks Points = Result · 500 / (A·Bw^5 + B·Bw^4 + C·Bw^3 + D·Bw^2 + E·Bw + F)` with
  - Men: A = −0.00000001291, B = 0.00000701863, C = −0.00113732, D = −0.002388645, E = 16.2606339, F = −216.0475144
  - Women: A = −0.00000009054, B = 0.00004731582, C = −0.00930733913, D = 0.82112226871, E = −27.23842536447, F = 594.31747775582
  - Reversed to ascending order (F, E, D, C, B, A), these equal the registry exactly: **12/12 match** (registry `7.01863e-6` = 0.00000701863 and `-1.291e-8` = −0.00000001291).
- **Wilks R (undated; PDF created 2008-10-03). *Wilks Formula for Men and Women by Robert Wilks, Australia*.** Coefficient tables hosted by the European Powerlifting Federation. https://www.europowerlifting.org/fileadmin/data/wilks_formula/Wilksformula_01.pdf. Tables in 0.1 kg steps: men 40.0–205.9 kg, women 40.0–150.9 kg. Worked example in the text: "69.3 kg has a coefficient of .7552" (reproduced: 0.7552).
  - Recomputing each cell from the registry polynomial (500/poly, rounded half-up to 4 dp):
    - Women: **1,110/1,110 exact**.
    - Men: **1,651/1,660 exact**. The other 9 are lower by one unit in the 4th decimal at 83.2, 140.6, 144.1, 153.2, 161.9, 195.7, 197.2, 197.8 and 200.5 kg. In every one of these the registry value lies within 9×10⁻⁷ above an exact rounding half-point (e.g. 83.2 kg: 0.66655005 gives 0.6666, table 0.6665), and no constant offset explains them. This is rounding or arithmetic noise in the original table generator, not a coefficient difference.

### Test vectors
- Men 100 kg / 1000 kg gives **608.58907191** (EB 608.58907) ✓.
- Women 60 kg / 500 kg gives **557.44343765** (EB 557.4434) ✓.

### Bodyweight clamps
Neither source states a clamp. The Wilks table covers men 40.0–205.9 kg (smallest coefficient 0.5315, printed from 200.5 to 203.5 kg, rising to 0.5318 by 205.9 kg) and women 40.0–150.9 kg. Registry clamps: men 40–201.9 kg, women 26.51–154.53 kg (OPL). These are not contradicted, because the documents simply tabulate a narrower or different range.

**Verdict: Verify `scoring.wilks.coefficients` against the IPF-hosted Kopayev et al. 2020 report (polynomial) and Robert Wilks' tables (EPF-hosted; tabulated values reproduce the polynomial). Confidence high for the values, medium for primacy:** no Wilks-authored polynomial publication or rulebook printing the polynomial was found.

## 5. Shared corroborating source
Kopayev, Onyshchenko and Stetsenko's IPF-hosted 2020 report (see §4) prints all of Wilks, Wilks-2, DOTS, IPF Points and GL in Appendix 1. Every Wilks, Wilks2020, DOTS and GL coefficient in the registry matches it (58/58). Its IPF Points table rounds to 4 dp (e.g. Men Classic Bench C = 17.5785 vs 17.57845 in the Marksteiner document). This is display rounding only; no action is needed for the verified IPF Points row.

## Proposed source-registry entries (`packages/rules/data/sources/scoring.yaml`)

```yaml
- id: src.ipf2020
  citation: >-
    International Powerlifting Federation 2020. The IPF GL Coefficients for Relative Scoring,
    actual from May 01, 2020 to Dec 31, 2023 (May 2020; PDF v0.6.5). IPF formula documents,
    powerlifting.sport.
  url: https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf
  seeAlso:
    - https://www.powerlifting.sport/rules/codes/info/ipf-formula
    - https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Announcement_IPF_GL_Formula_2020_1_.pdf
    - https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Championships-IPF-GL.xlsm
  tag: OFFICIAL
  status: active
  note: >-
    Table 1 prints all eight A/B/C sets (identical to the registry). Formula 2 states
    Bwt >= 40 kg (men) and >= 35 kg (women). Coefficient and points are rounded to 6 dp; points
    are shown to 3 dp on general sheets. Worked examples: 92.04 kg/1035 kg = 112.855365;
    70.50 kg/122.5 kg = 96.783453. No later coefficient set found as of 2026-11.

- id: src.kopayev2020
  citation: >-
    Kopayev O, Onyshchenko B, Stetsenko A 2020. Report: Evaluation of Wilks, Wilks-2, DOTS, IPF
    and GoodLift formulas for calculating relative scores in IPF powerlifting competitions
    (March 2020). International Powerlifting Federation, IPF formula documents.
  url: https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Models_Evaluation-I-2020_01.pdf
  tag: OFFICIAL
  status: active
  note: >-
    Appendix 1 prints the coefficients of Wilks (500), Wilks-2 (600), DOTS (500), IPF Points and
    GL; all Wilks, Wilks2020, DOTS and GL values equal the registry. Secondary to the formula
    authors for Wilks, Wilks-2 and DOTS, but federation-published.

- id: src.wilks2008
  citation: >-
    Wilks R [undated; PDF 2008]. Wilks Formula for Men and Women by Robert Wilks, Australia
    (coefficient tables, 0.1 kg steps). European Powerlifting Federation download.
  url: https://www.europowerlifting.org/fileadmin/data/wilks_formula/Wilksformula_01.pdf
  tag: OFFICIAL
  status: active
  note: >-
    Tabulated original (1995) Wilks coefficients, men 40.0-205.9 kg, women 40.0-150.9 kg. The
    registry polynomial reproduces all 1,110 women's cells and 1,651/1,660 men's cells exactly;
    the other 9 differ by 1 in the 4th decimal at rounding half-points. Prints no polynomial.

- id: src.pa2020
  citation: >-
    Powerlifting Australia 2020. Wilks Formula 2 Released (news, 28 February 2020) and Wilks
    Formula page (calculator and 0.05 kg coefficient tables). powerliftingaustralia.com.
  url: https://powerliftingaustralia.com/wilks-formula/
  seeAlso:
    - https://powerliftingaustralia.com/2020/02/28/wilks-formula-2-released/
    - https://worldpowerlifting.com/technical/wilks-formula-calculator/
  tag: OFFICIAL
  status: active
  note: >-
    Calculator equation 600/(a + b·x + … + f·x^5) with all 12 coefficients equal to the
    registry; tables men 40-200.95 kg, women 40-150.95 kg reproduce cell for cell. The
    announcement does not name the author; World Powerlifting's "Official Wilks Formula" page
    carries the same equation and tables.

- id: src.konertz2019
  citation: >-
    Konertz T 2019. Die DOTS-Formeln – Die neuen Wilks. Kraftsport Colonia website (published
    15 October 2019).
  url: https://kraftsport-colonia.de/dots
  tag: OFFICIAL
  status: active
  note: >-
    Author's publication of DOTS: 500/(A·Bw^4 + B·Bw^3 + C·Bw^2 + D·Bw + E); coefficients equal
    the registry. Domain men 40-210 kg, women 40-150 kg, with the boundary coefficient applied
    outside (= registry clamps). Derivation is described only qualitatively. The BVDK adoption
    notice (bvdk.de, 2019) could not be opened (HTTP 404).
```

## Proposed registry edits (for the user to apply; not made)
- `scoring.ipfGl.coefficients`: `verified: true`; `sources: [src.ipf2020, src.kopayev2020, src.opl-goodlift]`. Drop `src.vcalc-ipf-gl` and replace the note.
- `scoring.dots.coefficients`: `verified: true`; `sources: [src.konertz2019, src.kopayev2020, src.opl-dots]`. Reword the "No official derivation" note.
- `scoring.wilks2020.coefficients`: `verified: true`; `sources: [src.pa2020, src.kopayev2020, src.opl-wilks2020]`.
- `scoring.wilks.coefficients`: `verified: true`; `sources: [src.kopayev2020, src.wilks2008, src.opl-wilks]`. Note: "no Wilks-authored polynomial publication found; IPF rulebook 2016 prints none".
- Update the file-header comment (the four sets are no longer pending) and the `src.opl-goodlift` note.
- Decide separately: `scoring.ipfGl.minBodyweightKg` (IPF document: men ≥ 40 kg, women ≥ 35 kg) and whether GL display uses the IPF rounding procedure (6-dp coefficient; 3-dp display). The EB vector 112.85 assumes an unrounded coefficient and 2-dp display; the IPF procedure gives 112.855 (3 dp) or 112.86 (2 dp).

## Not found / not opened
- BVDK DOTS adoption notice and BVDK committee news (original URLs return 404; Internet Archive offline during this session).
- IPF Technical Rules Book 2017 and 2018 (not on the IPF server; archive offline). The 2016, 2020 and 2026 editions were opened and print no scoring coefficients. The 2026 copy opened was hosted by the Irish Powerlifting Federation: https://www.irishpowerliftingfederation.com/wp-content/uploads/2026/03/2026-IPF-Technical-Rulebook-effective-01-March-2026-v3.pdf
- Any Robert Wilks publication that prints the 1995 or 2020 polynomial under his own name.
- Vanderburgh & Batterham 1999 full text.
