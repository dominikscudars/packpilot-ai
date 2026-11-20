import { describe, expect, it } from "vitest";
import { parseTable, summaryText, tabulate } from "../survey/tabulate";
import { buildSurvey, googleFormScript, surveyText } from "../survey/questions";
import { buildForecast } from "../forecast/forecast";

describe("survey results", () => {
  const csv = [
    "Timestamp,How often?,Where do you buy?,Bought before?,What would you change?",
    '1/1,Weekly,"Rimi, Lidl","Yes, regularly",Easier to open without scissors please',
    '1/2,Weekly,"Lidl, Maxima","Yes, a few times",Less plastic would be great for me',
    '1/3,Monthly,Lidl,"Yes, regularly","Bigger packs, honestly, would be nice"',
    '1/4,Weekly,"Rimi, Maxima, Lidl",No,Nothing really to change about it',
    '1/5,Monthly,"Rimi, Online","Yes, regularly",Recyclable packaging is what I want',
    '1/6,Weekly,"Online, Lidl",No,A zip lock would help after opening',
    '1/7,Weekly,"Maxima, Online","Yes, a few times",Smaller packs for single people',
    '1/8,Weekly,"Rimi, Lidl, Online",No,Show the best-before date bigger',
    '1/9,Monthly,"Maxima, Rimi","Yes, regularly",It leaks water when I open it',
    '1/10,Weekly,"Lidl, Rimi, Maxima, Online",No,More information about storage',
  ].join("\n");
  const { responses, questions } = tabulate(parseTable(csv));
  it("counts answers, splits checkboxes and keeps comma answers whole", () => {
    expect(responses).toBe(10);
    const often = questions.find((q) => q.question === "How often?");
    expect(often?.answers).toEqual([
      { label: "Weekly", count: 7 },
      { label: "Monthly", count: 3 },
    ]);
    const where = questions.find((q) => q.question === "Where do you buy?");
    expect(where?.answers.find((a) => a.label === "Lidl")?.count).toBe(7);
    const before = questions.find((q) => q.question === "Bought before?");
    expect(before?.answers).toContainEqual({
      label: "Yes, regularly",
      count: 4,
    });
    expect(before?.answers).toHaveLength(3);
    const change = questions.find(
      (q) => q.question === "What would you change?",
    );
    expect(change?.kind).toBe("text");
    expect(change?.examples.length).toBeGreaterThan(0);
  });
  it("reads cells pasted from a spreadsheet (tab-separated)", () => {
    const rows = parseTable("Q1\tQ2\nA\tB\nA\tC\n");
    expect(tabulate(rows).questions.map((q) => q.answers.length)).toEqual([
      1, 2,
    ]);
  });
  it("summarises for the assistant with counts and percentages", () => {
    const text = summaryText(responses, questions);
    expect(text).toContain("10 responses.");
    expect(text).toContain("- Weekly: 7 (70%)");
  });
});

describe("survey questions", () => {
  it("uses the company's pack sizes and adds a price question with €/kg", () => {
    const qs = buildSurvey({
      product: "fresh tofu",
      brand: "OG TOFU",
      sizes: [1000, 250, 500],
      prices: { 1000: 4, 500: 2.25, 250: 1.25 },
    });
    expect(
      qs.find((q) => q.title.startsWith("Which pack size"))?.options,
    ).toEqual(["250 g", "500 g", "1 kg", "Depends on the price per kg"]);
    expect(qs.find((q) => q.title.startsWith("Imagine"))?.options).toContain(
      "250 g — €1.25 (€5.00/kg)",
    );
    expect(surveyText(qs)).toContain("[Checkboxes (several answers)]");
  });
  it("leaves the price question out without at least two prices", () => {
    const qs = buildSurvey({
      product: "",
      brand: "",
      sizes: [500],
      prices: { 500: 2 },
    });
    expect(qs.some((q) => q.title.startsWith("Imagine"))).toBe(false);
  });
});

describe("Google Form script", () => {
  it("adds every question with its type and options, escaping input", () => {
    const qs = buildSurvey({
      product: 'tofu "classic"',
      brand: "OG TOFU",
      sizes: [500, 1000],
      prices: {},
    });
    const script = googleFormScript("OG TOFU survey", "Two\nlines", qs);
    expect(script).toContain('FormApp.create("OG TOFU survey")');
    expect(script).toContain('setDescription("Two\\nlines")');
    expect(script).toContain('"How often do you buy tofu \\"classic\\"?"');
    expect(script.match(/addMultipleChoiceItem/g)?.length).toBe(
      qs.filter((q) => q.type === "one").length,
    );
    expect(script).toContain("addCheckboxItem");
    expect(script).toContain("addParagraphTextItem");
    expect(script).toContain('["500 g","1 kg","Depends on the price per kg"]');
    // The script is valid JavaScript (Apps Script runs V8).
    expect(() => new Function(script)).not.toThrow();
  });
});

describe("sales forecast", () => {
  const formats = [
    { id: "f1", grams: 1000 },
    { id: "f2", grams: 250 },
  ];
  it("fits a straight-line trend and averages the recent pack mix", () => {
    const rows = parseTable(
      "Month\t1 kg\t250 g\tNotes\n2026-07\t800\t800\tx\n2026-08\t900\t800\t\n2026-09\t1000\t800\t",
    );
    const f = buildForecast(rows, formats, "packs");
    expect(f.history.map((h) => h.totalKg)).toEqual([1000, 1100, 1200]);
    expect(f.trendKgPerMonth).toBe(100);
    expect(f.forecast.at(0)).toEqual({ label: "2026-10", totalKg: 1300 });
    expect(f.forecast.at(-1)).toEqual({ label: "2027-03", totalKg: 1800 });
    expect(f.shares.f1 + f.shares.f2).toBe(100);
    expect(f.shares.f1).toBe(81.8);
    expect(f.unmatched).toEqual(["Notes"]);
  });
  it("reads kg columns when the numbers are kilograms", () => {
    const rows = parseTable("Month,1 kg,250 g\n2026-09,700,50\n");
    expect(buildForecast(rows, formats, "kg").history.at(0)?.totalKg).toBe(750);
  });
});
