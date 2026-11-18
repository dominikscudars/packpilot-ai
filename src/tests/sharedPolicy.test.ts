import { expect, it } from "vitest";
import { createDemoGateway, DEMO_KEY } from "../demo/apiDemo";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";
import { assumed } from "../../backend/src/domain/inputs";
const demo = () =>
  createDemoGateway({ getItem: () => null, setItem: () => {} }, () => {});
it("preserves exact OG TOFU reference values through the demo gateway", async () => {
  const result = await demo().calculate(createDemoScenario());
  expect(result.rows.map((r) => r.packages)).toEqual([800, 300, 200]);
  expect(result).toMatchObject({
    totalPackages: 1300,
    totalMaterialEuro: "91",
    totalLaborEuro: "195",
    totalPackagingOperatingEuro: "286",
    packagingEuroPerPlannedKg: "0.286",
    unpackagedProductionKg: "0",
  });
});
it.each(["0", "1", "1.125", "1000.125"])(
  "uses backend mass allocation and continuous time at %s kg",
  async (kg) => {
    const input = createDemoScenario();
    input.monthlyProductionKg = assumed(kg, "Test only");
    const result = await demo().calculate(input);
    expect(result).toEqual(calculatePackaging(input));
    expect(Number(result.packedProductionKg)).toBeLessThanOrEqual(Number(kg));
    if (kg === "1.125") expect(result.unpackagedProductionKg).toBe("0.125");
  },
);
it("reads only the new isolated demo key and reports unreadable storage", () => {
  const keys: string[] = [],
    notices: string[] = [];
  createDemoGateway(
    {
      getItem: (key) => {
        keys.push(key);
        return "broken";
      },
      setItem: () => {},
    },
    (text) => notices.push(text),
  );
  expect(keys).toEqual([DEMO_KEY]);
  expect(notices[0]).toContain("could not be read");
});
