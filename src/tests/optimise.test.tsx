import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { assumed, missing } from "../../backend/src/domain/inputs";
import { optimisations } from "../forecast/optimise";
import { NO_CHANGE, scenarioAtEnd } from "../forecast/projection";
import { enterReferenceData, openTab, type } from "./journey";

describe("ways to optimise the forecast", () => {
  it("recalculates each option with the engine on the projected figures", () => {
    const end = scenarioAtEnd(createDemoScenario(), {
      ...NO_CHANGE,
      productionChangePct: 100,
    });
    const { options, base } = optimisations(end);
    expect(base.cost).toBe(572);
    const byId = Object.fromEntries(options.map((o) => [o.id, o]));
    // 5 points of 250 g volume into 1 kg packs: 2,300 packs × €0.22 = €506.
    expect(byId.mix.savingEuro).toBe(66);
    expect(byId.mix.euroPerKg.to).toBeCloseTo(0.253, 6);
    // 10 % off €0.07 bags on 2,600 packs.
    expect(byId.material.savingEuro).toBe(18.2);
    // 10 % less labour per pack (€0.15 → €0.135) on 2,600 packs.
    expect(byId.labour.savingEuro).toBe(39);
    // Twice the packs per cycle halves machine time.
    expect(byId.machine.machineHours.to).toBeCloseTo(
      byId.machine.machineHours.from! / 2,
      6,
    );
    // Without a capacity problem, the biggest saving comes first.
    expect(options[0].id).toBe("mix");
  });

  it("puts capacity fixes first when packing would exceed available hours", () => {
    const input = createDemoScenario();
    input.machines[0].availableHoursPerMonth = assumed("20", "test");
    const { options, overCapacity } = optimisations(
      scenarioAtEnd(input, { ...NO_CHANGE, productionChangePct: 100 }),
    );
    expect(overCapacity).toBe(true);
    expect(options[0]).toMatchObject({ id: "machine", solvesCapacity: true });
    const capacity = options.find((o) => o.id === "capacity")!;
    expect(capacity.title).toBe("Add about 5.3 machine hours a month");
    expect(capacity.solvesCapacity).toBe(true);
  });

  it("offers only options the entered data supports", () => {
    const input = createDemoScenario();
    input.labor = { method: "perPackage", euroPerPackage: missing() };
    input.formats.forEach((f) => {
      f.materialCost = {
        method: "combined",
        combinedEuroPerPackage: missing(),
      };
    });
    const ids = optimisations(input).options.map((o) => o.id);
    expect(ids).not.toContain("labour");
    expect(ids).not.toContain("material");
  });
});

describe("optimise panel in the workspace", () => {
  it("updates with the projection and hands an option to market research", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App
          services={{
            auth: null,
            apiUrl: "http://localhost:3001",
            error: null,
          }}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
    await enterReferenceData();
    openTab("Forecast");
    const panel = await screen.findByTestId("optimise");
    expect(panel).toHaveTextContent("Ways to optimise your costs");
    expect(within(panel).getByTestId("option-mix")).toHaveTextContent(
      "−€33.00 a month",
    );
    type("Production change", "100");
    expect(screen.getByTestId("projection-summary")).toHaveTextContent(
      "€572 a month",
    );
    expect(screen.getByTestId("option-mix")).toHaveTextContent(
      "−€66.00 a month",
    );
    fireEvent.click(
      within(screen.getByTestId("option-machine")).getByRole("link", {
        name: "Research this →",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Market research" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveValue(
      "Which double-chamber vacuum packaging machines would suit us, what do they cost, and how fast would they pay back with our volumes?",
    );
  });
});
