import { describe, expect, it } from "vitest";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { assumed } from "../../backend/src/domain/inputs";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";
import { evaluate } from "../advisor/server";
import { PREPARED_ANSWERS } from "../advisor/preparedAnswers";

const q = (v: string) => assumed(v, "Prepared-answer check");
/** OG TOFU demo with hourly labour derived from €0.15 per 35 s pack. */
function og(kg: string) {
  const s = createDemoScenario();
  s.monthlyProductionKg = q(kg);
  s.labor = { method: "hourly", euroPerPersonHour: q("15.43") };
  s.machines[0].maintenanceEuroPerMonth = q("0");
  s.additionalOperatingEuroPerMonth = q("0");
  return s;
}
const euro = (v: string | null) =>
  `€${Math.round(Number(v)).toLocaleString("en-US")}`;
const text = (start: string) =>
  PREPARED_ANSWERS.find((a) => a.question.startsWith(start))?.answer ?? "";

describe("prepared answers quote PackPilot's own calculations", () => {
  it("machinery figures match the engine", () => {
    const answer = text("Which packing machines");
    const current = calculatePackaging(og("10000"));
    expect(answer).toContain(
      `${euro(current.totalPackagingOperatingEuro)} a month`,
    );
    expect(answer).toContain(
      `${Math.round(Number(current.machineHours))} machine-hours`,
    );
    const double = evaluate(og("10000"), {
      label: "double",
      machine: { cycleSeconds: 40, packsPerCycle: 4, investmentEuro: 8500 },
    });
    expect(answer).toContain(
      euro(double.alternative.packagingCostEuroPerMonth),
    );
    expect(answer).toContain(
      `saving about ${euro(double.comparedWithCurrent.monthlyNetSavingsEuro)}`,
    );
    expect(
      Math.round(Number(double.comparedWithCurrent.simplePaybackMonths)),
    ).toBe(6);
    const belt = evaluate(og("10000"), {
      label: "belt",
      machine: { cycleSeconds: 20, packsPerCycle: 4, investmentEuro: 40000 },
    });
    expect(answer).toContain(euro(belt.alternative.packagingCostEuroPerMonth));
    expect(
      Math.round(Number(belt.comparedWithCurrent.simplePaybackMonths)),
    ).toBe(24);
    const retail = evaluate(og("10000"), {
      label: "retail",
      formats: [
        { formatId: "og-format-1kg", sharePercent: 50 },
        { formatId: "og-format-500g", sharePercent: 30 },
        { formatId: "og-format-250g", sharePercent: 20 },
      ],
    });
    expect(answer).toContain(
      `${Math.round(Number(retail.alternative.machineHours))} hours`,
    );
    const small = evaluate(og("1000"), {
      label: "double at 1 t",
      machine: { cycleSeconds: 40, packsPerCycle: 4, investmentEuro: 8500 },
    });
    expect(answer).toContain(
      `about ${euro(small.comparedWithCurrent.monthlyNetSavingsEuro)} a month`,
    );
  });
  it("material and pack-size figures match the engine", () => {
    const rows = calculatePackaging(createDemoScenario()).rows;
    expect(rows.map((r) => Number(r.packagingEuroPerPackedKg))).toEqual([
      0.22, 0.44, 0.88,
    ]);
    const mono = text("Are there recyclable");
    for (const [kg, label] of [
      ["1000", "at 1 t"],
      ["10000", "at 10 t"],
    ]) {
      const e = evaluate(og(kg), {
        label: "mono",
        formats: ["og-format-1kg", "og-format-500g", "og-format-250g"].map(
          (formatId) => ({ formatId, materialEuroPerPack: 0.09 }),
        ),
      });
      expect(mono).toContain(
        `${euro(e.comparedWithCurrent.changeInPackagingCostEuroPerMonth)} a month ${label}`,
      );
    }
  });
  it("every answer cites sources", () => {
    for (const a of PREPARED_ANSWERS) {
      expect(a.sources.length).toBeGreaterThan(0);
      for (const s of a.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });
});
