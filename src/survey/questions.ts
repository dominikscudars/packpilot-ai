/**
 * Builds a customer survey from the company's own pack sizes and prices,
 * following the structure of the consumer survey OG TOFU ran in 2026.
 */
export interface SurveyQuestion {
  title: string;
  type: "one" | "several" | "text";
  options: string[];
}

export interface SurveyInput {
  product: string;
  brand: string;
  /** Pack sizes in grams, from step 1. */
  sizes: number[];
  /** Optional shelf price per pack in euro, by pack size in grams. */
  prices: Record<number, number | undefined>;
}

const sizeLabel = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;
const euro = (n: number) => `€${n.toFixed(2)}`;

export function buildSurvey(input: SurveyInput): SurveyQuestion[] {
  const product = input.product.trim() || "our product";
  const brand = input.brand.trim() || "our brand";
  const sizes = [...new Set(input.sizes)]
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  const priced = sizes.filter((g) => (input.prices[g] ?? 0) > 0);
  const questions: SurveyQuestion[] = [
    {
      title: `How often do you buy ${product}?`,
      type: "one",
      options: [
        "Several times a week",
        "About once a week",
        "2–3 times a month",
        "Once a month or less",
      ],
    },
    {
      title: `Where do you usually buy ${product}?`,
      type: "several",
      options: [
        "Supermarket",
        "Discount store",
        "Specialist or health-food shop",
        "Directly from the producer",
        "Online",
      ],
    },
    {
      title: `How much ${product} do you usually use in one meal?`,
      type: "one",
      options: [
        "Up to 100 g",
        "101–200 g",
        "201–300 g",
        "301–500 g",
        "More than 500 g",
      ],
    },
    {
      title: "How many people do you usually cook for?",
      type: "one",
      options: ["1", "2", "3–4", "5 or more"],
    },
    {
      title: "Which pack size would you prefer for regular use?",
      type: "one",
      options: [...sizes.map(sizeLabel), "Depends on the price per kg"],
    },
  ];
  if (priced.length >= 2)
    questions.push({
      title: `Imagine ${product} of the same quality at these prices. Which would you choose?`,
      type: "one",
      options: priced.map((g) => {
        const price = input.prices[g] ?? 0;
        return `${sizeLabel(g)} — ${euro(price)} (${euro((price * 1000) / g)}/kg)`;
      }),
    });
  questions.push(
    {
      title: `What usually happens to leftover ${product} after opening?`,
      type: "one",
      options: [
        "Nothing is left over",
        "I use it the next day",
        "I store it and use it later",
        "Sometimes I have to throw it away",
      ],
    },
    {
      title: `What matters most when you choose ${product}? (up to 3)`,
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
    },
    {
      title: "Would you pay more for packaging that is easier to recycle?",
      type: "one",
      options: [
        "No",
        "Up to €0.10 more per pack",
        "€0.11–0.25 more per pack",
        "More than €0.25 more per pack",
        "Depends on the pack size",
      ],
    },
    {
      title: `Have you bought ${brand} before?`,
      type: "one",
      options: [
        "Yes, regularly",
        "Yes, a few times",
        "I have heard of it but not bought it",
        "I did not know it",
      ],
    },
    {
      title: `What would you change about ${product} packaging?`,
      type: "text",
      options: [],
    },
  );
  return questions;
}

const TYPE_HINT: Record<SurveyQuestion["type"], string> = {
  one: "Multiple choice (one answer)",
  several: "Checkboxes (several answers)",
  text: "Paragraph (free text)",
};

/** Plain text to paste into Google Forms, one question at a time. */
export function surveyText(questions: SurveyQuestion[]): string {
  return questions
    .map(
      (q, i) =>
        `${i + 1}. ${q.title}\n[${TYPE_HINT[q.type]}]${q.options.length ? `\n${q.options.join("\n")}` : ""}`,
    )
    .join("\n\n");
}

const FORM_METHOD: Record<SurveyQuestion["type"], string> = {
  one: "addMultipleChoiceItem",
  several: "addCheckboxItem",
  text: "addParagraphTextItem",
};

/**
 * Google Apps Script that builds the survey as a live Google Form.
 * Every user-entered string goes through JSON.stringify, so quotes or
 * newlines in a product name cannot break out of the script.
 */
export function googleFormScript(
  title: string,
  description: string,
  questions: SurveyQuestion[],
): string {
  const items = questions.map((q) =>
    q.type === "text"
      ? `  form.${FORM_METHOD[q.type]}().setTitle(${JSON.stringify(q.title)});`
      : `  form.${FORM_METHOD[q.type]}()\n    .setTitle(${JSON.stringify(q.title)})\n    .setChoiceValues(${JSON.stringify(q.options)});`,
  );
  return [
    "function createSurveyForm() {",
    `  const form = FormApp.create(${JSON.stringify(title)});`,
    `  form.setDescription(${JSON.stringify(description)});`,
    ...items,
    '  Logger.log("Share with customers: " + form.getPublishedUrl());',
    '  Logger.log("Edit the form: " + form.getEditUrl());',
    "}",
    "",
  ].join("\n");
}
