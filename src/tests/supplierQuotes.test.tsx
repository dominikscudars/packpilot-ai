import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import App from "../App";
import { enterReferenceData } from "./journey";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { missing } from "../../backend/src/domain/inputs";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";
import { compareQuotes } from "../calculations/supplierQuotes";
import { EXAMPLE_QUOTES } from "../demo/supplierQuotes";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: () => <div />,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
}));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const examples = EXAMPLE_QUOTES.map((q) => ({
  ...q,
  setupFeeEuro: q.setupFeeEuro || null,
}));

describe("compareQuotes", () => {
  it("compares the example quotes with the OG TOFU reference (1,300 packs, €91)", () => {
    const c = compareQuotes(calculatePackaging(createDemoScenario()), examples);
    expect(c.currentMaterialEuroPerKg).toBe("0.0910");
    const [a, b, cc] = c.quotes;
    expect(a).toMatchObject({
      monthlyMaterialEuro: "84.50",
      materialEuroPerKg: "0.0845",
      differenceEuroPerMonth: "-6.50",
      minimumOrderMonths: "3.8",
      firstOrderEuro: "325.00",
      setupPaybackMonths: null,
    });
    expect(b).toMatchObject({
      monthlyMaterialEuro: "75.40",
      differenceEuroPerMonth: "-15.60",
      minimumOrderMonths: "15.4",
      firstOrderEuro: "1310.00",
      setupPaybackMonths: "9.6",
    });
    expect(cc).toMatchObject({
      monthlyMaterialEuro: "96.20",
      differenceEuroPerMonth: "5.20",
      minimumOrderMonths: "0.8",
    });
  });

  it("keeps savings Unknown, never €0, when the current material cost is Unknown", () => {
    const input = createDemoScenario();
    input.formats[0].materialCost = {
      method: "combined",
      combinedEuroPerPackage: missing(),
    };
    const c = compareQuotes(calculatePackaging(input), examples);
    expect(c.currentMaterialEuroPerKg).toBeNull();
    expect(c.quotes[0].monthlyMaterialEuro).toBe("84.50");
    expect(c.quotes.map((q) => q.differenceEuroPerMonth)).toEqual([
      null,
      null,
      null,
    ]);
    expect(c.quotes[1].setupPaybackMonths).toBeNull();
  });

  it("handles zero production without dividing by zero", () => {
    const c = compareQuotes(
      { totalPackages: 0, monthlyProductionKg: "0", totalMaterialEuro: "0" },
      examples,
    );
    expect(c.quotes[0]).toMatchObject({
      monthlyMaterialEuro: "0.00",
      materialEuroPerKg: null,
      minimumOrderMonths: null,
      differenceEuroPerMonth: "0.00",
    });
  });
});

function renderDemo() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App
        services={{ auth: null, apiUrl: "http://localhost:3001", error: null }}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
}

describe("Compare supplier quotes panel", () => {
  it("loads the example quotes in one click and shows savings vs current", async () => {
    renderDemo();
    await enterReferenceData();
    const panel = screen.getByRole("region", {
      name: "Compare supplier quotes",
    });
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Load example supplier quotes",
      }),
    );
    const table = await within(panel).findByTestId("quote-comparison");
    expect(table).toHaveTextContent("€91.00");
    expect(table).toHaveTextContent("−€15.60");
    expect(table).toHaveTextContent("+€5.20");
    expect(table).toHaveTextContent("recovered in 9.6 months");
    // The saved data is unchanged.
    expect(screen.getByTestId("operating-cost")).toHaveTextContent("€286.00");
  });

  it("explains in plain English what to enter before quotes can be compared", async () => {
    renderDemo();
    fireEvent.click(
      await screen.findByRole("button", { name: "Skip for now" }),
    );
    expect(await screen.findByTestId("quotes-missing")).toHaveTextContent(
      "To compare quotes, first enter your monthly production and pack sizes",
    );
  });

  it("asks for a missing price instead of comparing an incomplete quote", async () => {
    renderDemo();
    await enterReferenceData();
    const panel = screen.getByRole("region", {
      name: "Compare supplier quotes",
    });
    fireEvent.change(
      within(panel).getByLabelText("Supplier name · supplier 1"),
      { target: { value: "Local bags" } },
    );
    expect(
      await within(panel).findByText(
        "Local bags: enter the price per pack as a number, 0 or more.",
      ),
    ).toBeInTheDocument();
  });
});
