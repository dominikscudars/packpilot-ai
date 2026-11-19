import type { AdvisorReply } from "./server";

/**
 * Research answers prepared by hand for OG TOFU's own questions (interview,
 * November 2026), shown in the advisor without calling the AI service.
 * Company figures come from PackPilot's engine on the OG TOFU demo data;
 * external facts come from the listed sources and were not independently
 * verified. Prices from listings are indicative only.
 */
export interface PreparedAnswer {
  question: string;
  answer: string;
  sources: AdvisorReply["sources"];
}

export const PREPARED_DATE = "19 November 2026";

const PPWR_SOURCES = [
  {
    title:
      "European Commission – New EU rules on packaging enter into application",
    url: "https://environment.ec.europa.eu/news/new-eu-rules-packaging-enter-application-2026-08-11_en",
  },
  {
    title:
      "EU Circular Economy Platform – When will the PPWR come into effect?",
    url: "https://circulareconomy.europa.eu/platform/en/news-and-events/all-news/eu-packaging-and-packaging-waste-regulation-when-will-it-come-effect-and-what-does-it-cover",
  },
  {
    title: "Food Packaging Forum – PPWR PFAS limits apply from August 12",
    url: "https://foodpackagingforum.org/news/ppwr-pfas-limits-apply-from-august-12",
  },
  {
    title:
      "Osborne Clarke – Packaging regulation set to transform EU market access",
    url: "https://www.osborneclarke.com/insights/packaging-regulation-set-transform-eu-market-access-businesses-august",
  },
  {
    title: "BRC – European Packaging and Packaging Waste Regulation",
    url: "https://brc.org.uk/news-and-events/news/associate-insight/2026/european-packaging-and-packaging-waste-regulation-ppwr/",
  },
];

const MONO_SOURCES = [
  {
    title: "Niederwieser – combivac monoPE (FachPack listing)",
    url: "https://www.fachpack.de/en/exhibitors/niederwieser-spa-2413234/combivac-monope-2477058",
  },
  {
    title: "The Vacuum Pouch Company – Recycla pouch specification",
    url: "https://thevacuumpouch.co.uk/wp-content/uploads/2025/10/VPC-Recycla-Pouch-Spec-Sheet.pdf",
  },
  {
    title: "Dow – High-barrier recyclable flexible packaging",
    url: "https://dow.com/documents/768/768-460-01-high-barrier-recyclable-flexible-packaging.pdf.html",
  },
  {
    title: "Mondi – Mono-material barrier packaging",
    url: "https://www.mondigroup.com/products-and-solutions/flexible-packaging/monomaterial-barrier-packaging/",
  },
  {
    title: "Plastics Engineering – Mono-material packaging with MDO and EVOH",
    url: "https://www.plasticsengineering.org/2025/10/monomaterial-packaging-unlocking-opportunities-with-mdo-and-evoh-009875.md",
  },
  {
    title:
      "Prepac – Recyclability of PA/PE multilayer packaging (German Minimum Standard)",
    url: "https://prepacgroup.de/en/newsroom/recyclability-pa-pe-multilayer-packaging-german-minimum-standard-2022",
  },
];

const MACHINE_SOURCES = [
  {
    title: "Henkelman – Double-chamber vacuum packaging machines",
    url: "https://henkelman.com/en/products/double-chamber-vacuuming-machines",
  },
  {
    title: "Machineseeker – Used Henkelman Polar 2-40 listing",
    url: "https://www.machineseeker.ie/henkelman-polar+2-40/i-21125912",
  },
  {
    title: "Machineseeker – Henkelman Titan 2-90 listing (cycle 30–50 s)",
    url: "https://www.machineseeker.ie/henkelman-titaan+2-90/i-22095123",
  },
  {
    title: "Making.com – Automatic belt chamber vacuum packing (Saccardo AS38)",
    url: "https://making.com/equipment/automatic-belt-chamber-vacuum-packing-for-meat-and-cheese",
  },
  {
    title: "Sealed Air – CRYOVAC AutoVac 95 vacuum system",
    url: "https://www.sealedair.com/products/food-packaging/vacuum-system",
  },
  {
    title: "Levapack – Vacuum packaging machine price guide (vendor)",
    url: "https://www.levapack.com/?p=75349",
  },
];

const FORMAT_SOURCES = [
  {
    title: "Dong Thap University Journal – Packaging and tofu quality at 4 °C",
    url: "https://dthujs.vn/index.php/nsen/article/view/2415",
  },
  {
    title: "FAO AGRIS – Pseudomonas in modified-atmosphere packaged tofu",
    url: "https://agris.fao.org/search/ar/records/65dfc7b9f125065445a910c5",
  },
  {
    title: "UGM repository – Shelf life of pasteurised packed tofu",
    url: "https://etd.repository.ugm.ac.id/home/detail_pencarian_downloadfiles/184863",
  },
  {
    title: "Point Five P5-RM semi-automatic tray sealer",
    url: "https://produceprocessing.net/?p=9665",
  },
  {
    title: "Exapro – JPACK TSS125 skin tray sealer listing",
    url: "https://www.exapro.com/jpack-tss125-skin-p260707063",
  },
];

const LATVIA_SOURCES = [
  {
    title: "Likumi.lv – Natural Resources Tax Law (English)",
    url: "https://likumi.lv/ta/en/en/id/124707-natural-resources-tax-law",
  },
  {
    title: "Pro Europe – Latvijas Zaļais punkts",
    url: "https://www.pro-e.org/latvia1.htm",
  },
  {
    title: "Regsurance – Latvia EPR guide",
    url: "https://regsurance.com/latvia-extended-producer-responsibility-epr-service-guide-registration-data-reporting/",
  },
];

export const PREPARED_ANSWERS: PreparedAnswer[] = [
  {
    question:
      "Which packing machines should we consider as we grow from 1 to 10 tonnes a month, and when?",
    answer: `## Recommendation
Keep the HURAKAN VAC 400 for now: at about 1 t a month no new machine pays for itself. Plan a **double-chamber vacuum machine** for when you pass roughly 3–5 t a month, and consider an automatic belt machine only near 10 t or if retail packs grow strongly.

## Your capacity today
- PackPilot calculates 12.6 machine-hours a month at 1 t (1,300 packs at 35 s each).
- At 10 t with today's mix (80% 1 kg) that becomes 126 hours, about one person packing full time. With a retail-heavy mix (50% 1 kg, 30% 500 g, 20% 250 g) it rises to 185 hours, more than one shift.
- So the pack-size mix matters as much as the tonnage.

## Options compared at 10 t a month
- **Keep the current machine:** €2,860 a month in packaging cost (materials plus labour), 126 machine-hours.
- **Double-chamber machine** (for example Henkelman Polar or Falcon family; one chamber is loaded while the other runs). Listed cycle times are about 25–60 s; a used Polar 2-40 was listed at €8,500. Tested as 4 packs per 40 s cycle: €1,467 a month and 36 hours, saving about €1,393 a month, **payback about 6 months**.
- **Automatic belt chamber machine** (for example Saccardo AS38, up to 24 packs a minute; CRYOVAC AutoVac 95, about 3 cycles a minute). A vendor guide puts EU brands at roughly $40,000–80,000. Tested as 4 packs per 20 s at €40,000: €1,189 a month and 18 hours, saving about €1,672 a month, **payback about 24 months**.
- At today's 1 t, the double-chamber machine would save only about €139 a month (payback about 5 years) and the belt machine about €167 a month.

## Important assumptions
- Labour is priced at €15.43 per hour, derived from your reported €0.15 per pack at 35 s per pack; please confirm the real wage.
- The savings assume packing time shrinks with machine time. Bagging and labelling by hand will not shrink as much, so treat these savings as an upper limit.
- Machine speeds and prices are from listings, not quotes; maintenance and electricity are excluded.

## Next steps
- Ask two or three suppliers for a demonstration with your own 250 g, 500 g and 1 kg packs, and ask how many packs fit per cycle on the seal bar.
- Get quotes for a new and a used double-chamber machine.
- Re-run this comparison in PackPilot when you reach about 3 t a month.`,
    sources: MACHINE_SOURCES,
  },
  {
    question:
      "Which packaging types suit fresh tofu in 1 kg, 500 g and 250 g packs: cost, 10-day freshness, shelf look and EU rules after 2030?",
    answer: `## Recommendation
Stay with vacuum pouches for all three sizes, and start testing a **recyclable mono-material PE pouch** now. Move retail packs to trays only if a retailer such as Klēts or Rimi commits to volumes that pay for a tray sealer.

## Options compared
- **PA/PE vacuum pouch (current):** about €0.06–0.08 per pack with label (your figure). A 2025 study of tofu at 4 °C found vacuum-sealed PA packs kept quality best over 10 days. Plain look on the shelf. Recyclability after 2030 is uncertain: coextruded PA/PE can count as "conditionally recyclable" under the German minimum standard only with a compatibiliser, and laminated versions do not qualify.
- **Mono-material PE vacuum pouch with a thin EVOH barrier:** sold as recyclable (for example Niederwieser combivac monoPE, The Vacuum Pouch Company's Recycla, structures from Dow and Mondi). It runs on chamber machines, but seal settings may need adjusting. No published shelf-life data for tofu, so a 10-day test is needed. Prices are not public; see the separate answer on mono-material bags.
- **Modified-atmosphere tray (MAP):** a study on tofu in 30% CO2 / 70% N2 slowed microbial growth for up to 14 days. Trays look better in retail and suit 250 g and 500 g packs, but need a tray sealer (a used semi-automatic skin/MAP sealer was listed at €26,000) and add tray cost and plastic.
- **Vacuum skin pack:** the most premium look, on a tray sealer with skin capability (for example Point Five P5-RM); slower than MAP.
- **Pasteurised tofu (your path B):** a study on pasteurised packed tofu estimated about 31 days at 5 °C. It changes the product, so test consumer acceptance before using it under the same brand.

## Cost per kilogram in PackPilot
Packing labour per pack is the same for every size, so a 250 g pack costs about €0.88 per kg to pack against €0.22 for 1 kg (500 g: €0.44). Any new material adds to this per pack, so it hits small packs hardest.

## Next steps
- Ask your bag supplier for mono-PE samples and run a 10-day shelf-life test.
- Ask Klēts which formats and volumes they would list before investing in trays.`,
    sources: [...FORMAT_SOURCES, ...MONO_SOURCES.slice(0, 2)],
  },
  {
    question:
      "Are there recyclable mono-material vacuum bags that keep tofu fresh for 10 days, and what would they change in price and equipment?",
    answer: `## Recommendation
Yes, recyclable mono-material vacuum pouches exist and are designed for chilled fresh foods. None has published shelf-life data for tofu, so **order samples and run your own 10-day test** before switching.

## What is available
- **Mono-PE pouches with an EVOH barrier layer:** Niederwieser's combivac monoPE, The Vacuum Pouch Company's Recycla (a 65-micron PE/EVOH pouch for soft meats and cheeses), and recyclable high-barrier structures from Dow and Mondi.
- Manufacturers keep the barrier resin below about 5% of the pack so it stays recyclable as PE.
- These are supplier claims: recyclability depends on the final structure, printing and local sorting. Ask for the supplier's recyclability certificate.

## Effect on your costs (PackPilot)
Suppliers publish no prices. If a mono-PE pouch costs 2 cents more per pack than today (€0.09 instead of €0.07), packaging cost rises by about **€26 a month at 1 t** and **€260 a month at 10 t**. Your total today is €286 a month at 1 t.

## Equipment
Mono-PE pouches are made for chamber vacuum machines, so the HURAKAN should work. PE seals at different settings than PA/PE, so test seal strength and adjust the seal time; check for leaks after chilling.

## Why it matters
From 2030 the EU Packaging Regulation (PPWR) requires packaging to reach a recyclability grade, and multilayer PA/PE is the type most at risk (see the answer on EU laws).

## Next steps
- Request samples and the declaration of compliance (food contact) and a recyclability statement from two suppliers.
- Test 10 days at +2…+6 °C: leaks, microbiology, smell and texture against your current bag.`,
    sources: MONO_SOURCES,
  },
  {
    question:
      "Which EU and Latvian packaging rules affect us, what changes by 2030, and what should we do now?",
    answer: `## Recommendation
Nothing forces you to change packaging today, but two things should be checked now: **PFAS limits**, which already apply, and **whether your bags will count as recyclable from 2030**.

## EU Packaging and Packaging Waste Regulation (PPWR), Regulation (EU) 2025/40
- In force since 11 February 2025; applies in general from **12 August 2026**.
- **PFAS in food-contact packaging:** from 12 August 2026, packaging above set limits may not be sold (reported limits: 25 ppb for one PFAS, 250 ppb for the sum, 50 ppm total). Ask your bag supplier for a written PFAS statement.
- **Labelling:** harmonised sorting labels are expected from about August 2028.
- **Recyclability:** from 2030 (1 January 2030, or 24 months after the detailed EU rules are adopted, whichever is later) packaging must reach recyclability grade A, B or C; from 2038 only A or B. Multilayer PA/PE bags may struggle here.

## Rules that already apply
- **Food-contact materials:** Regulation (EC) No 1935/2004 and, for plastics, Regulation (EU) No 10/2011. Your supplier must give you a declaration of compliance for the bags.
- **Food labelling:** Regulation (EU) No 1169/2011 (allergens, nutrition), in Latvian, under PVD supervision.

## Latvia
- Packaging put on the Latvian market falls under the Packaging Law and the Natural Resources Tax Law. You either pay the natural resources tax on packaging to VID or join a producer responsibility scheme such as Latvijas Zaļais punkts, which exempts you from the tax.
- One guide reports a threshold of 300 kg of packaging a year for joining a scheme; check this with VID or the scheme.

## Next steps
- Ask your bag supplier for the PFAS statement, the declaration of compliance and their plan for PPWR recyclability.
- Check your natural resources tax or Zaļais punkts status.
- Start a mono-material bag trial in 2027 so you are ready well before 2030.`,
    sources: [...PPWR_SOURCES, ...LATVIA_SOURCES],
  },
  {
    question:
      "Give us a step-by-step plan: what should we put in place now and what later as we grow?",
    answer: `## Recommendation
Spend little now, prepare for 2030, and tie each machine purchase to a production level PackPilot can calculate.

## Now (next 3 months)
- Keep the HURAKAN and current PA/PE bags.
- Collect the data that decides everything else: actual sales by pack size, wholesale price per size, the real hourly wage and bag cost per size.
- Ask your bag supplier for a PFAS statement and a declaration of compliance, and check your natural resources tax or Zaļais punkts status.

## Soon (3–12 months)
- Order mono-material PE vacuum pouch samples and run a 10-day shelf-life test.
- Use PackPilot to check whether 250 g and 500 g packs cover their extra cost (about €0.88 and €0.44 per kg to pack, against €0.22 for 1 kg).

## At about 3–5 t a month
- Get quotes for a double-chamber vacuum machine (used ones were listed from about €8,500). At 10 t, PackPilot estimates a payback of about 6 months; at 1 t it does not pay off.

## At about 8–10 t a month, or if retail packs pass roughly 30% of volume
- Consider an automatic belt chamber machine (roughly $40,000–80,000 for EU brands) or a second double-chamber machine.
- Consider MAP trays only with a retail contract that pays for a tray sealer.

## By 2030
- Switch to a recyclable bag that has passed your shelf-life test, before the PPWR recyclability grades apply.

All cost figures are PackPilot calculations on OG TOFU's reported data and labelled assumptions; machine prices are indicative listings, not quotes.`,
    sources: [
      ...MACHINE_SOURCES.slice(0, 2),
      ...MONO_SOURCES.slice(0, 1),
      ...PPWR_SOURCES.slice(0, 2),
    ],
  },
];
