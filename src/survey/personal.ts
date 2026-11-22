import type { ScenarioInput } from "../models/api";
import { optimisations } from "../forecast/optimise";
import type { SurveyQuestion } from "./questions";

/**
 * A survey written for one company: the questions depend on what the
 * company wants to learn, who will answer, and its own PackPilot numbers
 * (pack sizes, prices, cost per kg by pack size, the biggest saving found).
 * Rule-based on purpose: instant, no AI quota, and every number traceable.
 */
export type Goal = "packs" | "price" | "packaging" | "new";
export type Audience = "consumers" | "shops" | "restaurants";
export type Length = "short" | "full";

export interface PersonalQuestion extends SurveyQuestion {
  id: string;
  /** Why this question is asked, in terms of the company's own data. */
  why: string;
  /** Kept in a short survey. */
  core: boolean;
}

export interface SurveyContext {
  company: string;
  product: string;
  /** Pack sizes in grams, smallest first. */
  sizes: number[];
  /** Shelf price per pack in euro, by pack size in grams. */
  prices: Record<number, number | undefined>;
  /** Packaging cost per packed kg by pack size (engine), if known. */
  euroPerKg: Record<number, number | undefined>;
  /** Bag and label cost per pack, if the same for all sizes or the average. */
  materialPerPack: number | null;
  /** The biggest saving from moving volume to larger packs, if any. */
  mixSaving: { small: number; large: number; euro: number } | null;
}

export const GOALS: { id: Goal; label: string }[] = [
  { id: "packs", label: "Which pack sizes to sell" },
  { id: "price", label: "What prices customers accept" },
  { id: "packaging", label: "Greener or different packaging" },
  { id: "new", label: "Interest in new products" },
];
export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "consumers", label: "Shoppers who buy it" },
  { id: "shops", label: "Shops that stock it" },
  { id: "restaurants", label: "Restaurants and cafés" },
];

export const size = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;
const euro = (n: number, digits = 2) => `€${n.toFixed(digits)}`;

/** The company facts a personalised survey can use, from the saved inputs. */
export function surveyContext(
  input: ScenarioInput,
  company: string,
  product: string,
  prices: Record<number, number | undefined>,
): SurveyContext {
  const sizes = [
    ...new Set(
      input.formats
        .map((f) => Number(f.portionWeightGrams.value))
        .filter((g) => g > 0),
    ),
  ].sort((a, b) => a - b);
  const costs = input.formats
    .map((f) =>
      f.materialCost.method === "combined"
        ? Number(f.materialCost.combinedEuroPerPackage.value)
        : Number(f.materialCost.bagEuroPerPackage.value) +
          Number(f.materialCost.labelEuroPerPackage.value),
    )
    .filter((c) => Number.isFinite(c) && c > 0);
  const materialPerPack = costs.length
    ? costs.reduce((a, b) => a + b, 0) / costs.length
    : null;
  let euroPerKg: Record<number, number | undefined> = {};
  let mixSaving: SurveyContext["mixSaving"] = null;
  try {
    const { options } = optimisations(input);
    const mix = options.find((o) => o.id === "mix");
    if (mix && (mix.savingEuro ?? 0) > 0 && sizes.length >= 2)
      mixSaving = {
        small: sizes[0],
        large: sizes[sizes.length - 1],
        euro: mix.savingEuro ?? 0,
      };
    euroPerKg = packCostPerKg(input);
  } catch {
    // Incomplete inputs: the survey simply uses fewer numbers.
  }
  return {
    company,
    product,
    sizes,
    prices,
    euroPerKg,
    materialPerPack,
    mixSaving,
  };
}

function packCostPerKg(input: ScenarioInput) {
  const out: Record<number, number | undefined> = {};
  const labour =
    input.labor.method === "perPackage"
      ? Number(input.labor.euroPerPackage.value)
      : NaN;
  for (const f of input.formats) {
    const grams = Number(f.portionWeightGrams.value);
    const material =
      f.materialCost.method === "combined"
        ? Number(f.materialCost.combinedEuroPerPackage.value)
        : Number(f.materialCost.bagEuroPerPackage.value) +
          Number(f.materialCost.labelEuroPerPackage.value);
    const perPack = material + (Number.isFinite(labour) ? labour : 0);
    if (grams > 0 && Number.isFinite(perPack) && perPack > 0)
      out[grams] = (perPack * 1000) / grams;
  }
  return out;
}

/** Writes the survey for the chosen goals and audience. */
export function personalSurvey(
  ctx: SurveyContext,
  goals: Goal[],
  audience: Audience,
  length: Length,
): PersonalQuestion[] {
  const p = ctx.product.trim() || "our product";
  const brand = ctx.company.trim() || "our brand";
  const sizes = ctx.sizes;
  const small = sizes.at(0);
  const large = sizes.at(-1);
  const priced = sizes.filter((g) => (ctx.prices[g] ?? 0) > 0);
  const want = (g: Goal) => goals.includes(g);
  const q: PersonalQuestion[] = [];
  const add = (x: PersonalQuestion) => q.push(x);

  const gap =
    small &&
    large &&
    small !== large &&
    ctx.euroPerKg[small] &&
    ctx.euroPerKg[large]
      ? (ctx.euroPerKg[small]! / ctx.euroPerKg[large]!).toFixed(1)
      : null;

  if (audience === "consumers") {
    add({
      id: "frequency",
      title: `How often do you buy ${p}?`,
      type: "one",
      options: [
        "Several times a week",
        "About once a week",
        "2–3 times a month",
        "Once a month or less",
      ],
      why: "Shows how much volume each customer stands for.",
      core: false,
    });
    if (want("packs")) {
      add({
        id: "portion",
        title: `How much ${p} do you use in one meal?`,
        type: "one",
        options: [
          "Up to 100 g",
          "101–200 g",
          "201–300 g",
          "301–500 g",
          "More than 500 g",
        ],
        why: `Tells you whether ${small ? size(small) : "small"} packs match real portions.`,
        core: false,
      });
      add({
        id: "pack-preference",
        title: "Which pack size would you prefer for regular use?",
        type: "one",
        options: [...sizes.map(size), "Depends on the price per kg"],
        why: gap
          ? `Your ${size(small!)} packs cost ${gap}× more per kg to pack than ${size(large!)} packs.`
          : "Shows which of your pack sizes customers want.",
        core: true,
      });
      if (ctx.mixSaving)
        add({
          id: "switch",
          title: `If ${p} came in ${size(ctx.mixSaving.large)} packs at a lower price per kg, would you buy those instead of ${size(ctx.mixSaving.small)}?`,
          type: "one",
          options: [
            "Yes",
            "Maybe, if it keeps fresh after opening",
            "No, I need the smaller pack",
            "I would buy elsewhere",
          ],
          why: `Moving some volume from ${size(ctx.mixSaving.small)} to ${size(ctx.mixSaving.large)} saves you about ${euro(ctx.mixSaving.euro)} a month.`,
          core: true,
        });
      add({
        id: "leftover",
        title: `What happens to leftover ${p} after opening?`,
        type: "one",
        options: [
          "Nothing is left over",
          "I use it the next day",
          "I store it and use it later",
          "Sometimes I throw it away",
        ],
        why: "Waste after opening is the main reason customers avoid big packs.",
        core: false,
      });
    }
    if (want("price") || (want("packs") && priced.length >= 2)) {
      if (priced.length >= 2)
        add({
          id: "price-choice",
          title: `Same ${p}, same quality. Which would you choose?`,
          type: "one",
          options: priced.map((g) => {
            const price = ctx.prices[g] ?? 0;
            return `${size(g)} — ${euro(price)} (${euro((price * 1000) / g)}/kg)`;
          }),
          why: "Tests your real shelf prices against each other.",
          core: true,
        });
      if (want("price"))
        add({
          id: "price-max",
          title: `What is the most you would pay for a ${large ? size(large) : "large"} pack of ${p}?`,
          type: "one",
          options: priceBands(ctx.prices[large ?? 0]),
          why: ctx.prices[large ?? 0]
            ? `Your current price is ${euro(ctx.prices[large!]!)}; this shows the room above and below it.`
            : "Gives you a price range before you set one.",
          core: true,
        });
    }
    if (want("packaging")) {
      add({
        id: "recycle-pay",
        title: "Would you pay more for packaging that is easier to recycle?",
        type: "one",
        options: greenBands(ctx.materialPerPack),
        why: ctx.materialPerPack
          ? `Your bag and label cost ${euro(ctx.materialPerPack, 3)} per pack; this shows if customers would cover a greener one.`
          : "Shows if customers would cover greener packaging.",
        core: true,
      });
      add({
        id: "packaging-issues",
        title: `What bothers you about the packaging of ${p}? (choose any)`,
        type: "several",
        options: [
          "Hard to open",
          "Hard to close again",
          "Too much plastic",
          "Leaks or loses vacuum",
          "Label hard to read",
          "Nothing",
        ],
        why: "Points to the packaging change customers would notice.",
        core: false,
      });
    }
    add({
      id: "matters",
      title: `What matters most when you choose ${p}? (up to 3)`,
      type: "several",
      options: [
        "Taste and texture",
        "Price per kg",
        "Price per pack",
        "Shelf life",
        "Pack size",
        "Local origin",
        "Eco-friendly packaging",
      ],
      why: "Ranks price, size and packaging against taste.",
      core: !want("packaging") && !want("price"),
    });
    if (want("new"))
      add({
        id: "new-products",
        title: `What else would you like ${brand} to make?`,
        type: "text",
        options: [],
        why: "Ideas for products that use your current packing line.",
        core: true,
      });
    add({
      id: "aware",
      title: `Have you bought ${brand} before?`,
      type: "one",
      options: [
        "Yes, regularly",
        "Yes, a few times",
        "Heard of it, not bought",
        "Did not know it",
      ],
      why: "Separates loyal customers from new ones.",
      core: false,
    });
  }

  if (audience === "shops") {
    add({
      id: "shop-sellers",
      title: `Which ${p} pack sizes sell best in your shop?`,
      type: "several",
      options: sizes.map(size),
      why: gap
        ? `Your ${size(small!)} packs cost ${gap}× more per kg to pack than ${size(large!)} packs.`
        : "Shows which of your pack sizes the shelf needs.",
      core: true,
    });
    add({
      id: "shop-reorder",
      title: "How often would you reorder?",
      type: "one",
      options: ["Every week", "Every 2 weeks", "Every month", "Less often"],
      why: "Sets your production and bag ordering rhythm.",
      core: false,
    });
    if (want("packs") && large)
      add({
        id: "shop-large",
        title: `Would you list a ${size(large)} pack if it gave a better price per kg?`,
        type: "one",
        options: [
          "Yes",
          "Maybe, as a trial",
          "No, not enough shelf space",
          "No, customers want small packs",
        ],
        why: ctx.mixSaving
          ? `Selling more ${size(ctx.mixSaving.large)} packs saves you about ${euro(ctx.mixSaving.euro)} a month.`
          : "Larger packs cost less to pack per kilogram.",
        core: true,
      });
    if (want("price"))
      add({
        id: "shop-margin",
        title: "What margin do you need on a product like this?",
        type: "one",
        options: ["Under 20%", "20–30%", "30–40%", "Over 40%"],
        why: "Works back from shelf price to the price you can charge.",
        core: true,
      });
    if (want("packaging"))
      add({
        id: "shop-requirements",
        title: "What do you require from the packaging? (choose any)",
        type: "several",
        options: [
          "Longer shelf life",
          "Recyclable material",
          "Barcode and Latvian label",
          "Shelf-ready box",
          "Nothing special",
        ],
        why: "Lists what to agree with your bag and label supplier.",
        core: true,
      });
    if (want("new"))
      add({
        id: "shop-new",
        title:
          "What similar products do your customers ask for that you cannot get?",
        type: "text",
        options: [],
        why: "Shows gaps your line could fill.",
        core: true,
      });
  }

  if (audience === "restaurants") {
    add({
      id: "horeca-volume",
      title: `How many kilograms of ${p} do you use per week?`,
      type: "one",
      options: ["Under 2 kg", "2–5 kg", "5–10 kg", "More than 10 kg"],
      why: "Sizes this customer group against your monthly production.",
      core: true,
    });
    if (want("packs"))
      add({
        id: "horeca-pack",
        title: "Which pack size suits your kitchen best?",
        type: "one",
        options: [
          ...new Set([
            ...sizes.filter((g) => g >= 500).map(size),
            "2 kg",
            "5 kg",
          ]),
        ],
        why: large
          ? `Larger packs need fewer bags and less packing time than your ${size(large)} packs.`
          : "Larger kitchen packs need fewer bags and less packing time.",
        core: true,
      });
    add({
      id: "horeca-delivery",
      title: "How often would you like deliveries?",
      type: "one",
      options: ["Twice a week", "Once a week", "Every 2 weeks"],
      why: "Shelf life after delivery decides pack size and vacuum type.",
      core: false,
    });
    if (want("price"))
      add({
        id: "horeca-price",
        title: "What price per kg do you pay for similar products today?",
        type: "text",
        options: [],
        why: "Benchmarks your price per kg against what kitchens already pay.",
        core: true,
      });
    if (want("packaging"))
      add({
        id: "horeca-returnable",
        title: "Would you use returnable crates instead of single-use bags?",
        type: "one",
        options: ["Yes", "Maybe", "No"],
        why: ctx.materialPerPack
          ? `Each bag and label costs you ${euro(ctx.materialPerPack, 3)}.`
          : "Returnable crates cut bag costs.",
        core: true,
      });
    if (want("new"))
      add({
        id: "horeca-new",
        title: `What would you buy from ${brand} besides ${p}?`,
        type: "text",
        options: [],
        why: "Ideas for products for kitchens.",
        core: true,
      });
  }

  add({
    id: "change",
    title: `What one thing would you change about ${p} or its packaging?`,
    type: "text",
    options: [],
    why: "Catches what the other questions miss.",
    core: true,
  });

  return length === "short" ? q.filter((x) => x.core).slice(0, 6) : q;
}

function priceBands(current: number | undefined): string[] {
  if (!current || current <= 0)
    return ["Up to €2", "€2–3", "€3–4", "€4–5", "More than €5"];
  const r = (x: number) => Math.round(x * 4) / 4;
  const a = r(current * 0.85),
    b = r(current),
    c = r(current * 1.15);
  return [
    `Under ${euro(a)}`,
    `${euro(a)}–${euro(b)}`,
    `${euro(b)}–${euro(c)}`,
    `More than ${euro(c)}`,
  ];
}

function greenBands(material: number | null): string[] {
  if (!material)
    return [
      "No",
      "Up to €0.05 more",
      "€0.05–0.10 more",
      "More than €0.10 more",
    ];
  const step = Math.max(0.01, Math.round(material * 0.5 * 100) / 100);
  return [
    "No",
    `Up to ${euro(step)} more per pack`,
    `${euro(step)}–${euro(step * 2)} more per pack`,
    `More than ${euro(step * 2)} more per pack`,
  ];
}
