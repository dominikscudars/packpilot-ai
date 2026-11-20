import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import App from "../App";
import { enterReferenceData, navLink } from "./journey";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";
import { assumed } from "../../backend/src/domain/inputs";
import { completeness, observations } from "../insights/insights";
import { safeCell, toCsv } from "../insights/export";

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

describe("observations and completeness", () => {
  it("describes the OG TOFU reference from engine results only", () => {
    const input = createDemoScenario();
    const text = observations(calculatePackaging(input), input).map(
      (o) => o.text,
    );
    expect(text.length).toBeLessThanOrEqual(3);
    expect(text[0]).toMatch(/is the largest cost: \d+% of your €286\.00/);
    expect(text[1]).toMatch(/^250 g packs cost €0\.88\/kg/);
    expect(text[2]).toMatch(/machine-hours a month/);
  });
  it("lists blocked decisions and links each to its field", () => {
    const missing = completeness(createDemoScenario());
    expect(missing.map((m) => m.field)).toEqual(["equipment", "other-costs"]);
    const complete = createDemoScenario();
    complete.machines[0].availableHoursPerMonth = assumed("160", "t");
    complete.machines[0].maintenanceEuroPerMonth = assumed("0", "t");
    complete.additionalOperatingEuroPerMonth = assumed("0", "t");
    expect(completeness(complete)).toEqual([]);
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas and quotes separators", () => {
    expect(safeCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(safeCell("+1+1")).toBe("'+1+1");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell("\tcmd")).toBe("'\tcmd");
    expect(safeCell("-0.5")).toBe("-0.5");
    expect(safeCell("a,b")).toBe('"a,b"');
    expect(safeCell(null)).toBe("");
    expect(toCsv([["a", 1], ["=x"]])).toBe("a,1\r\n'=x");
  });
});

async function openReference(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        services={{ auth: null, apiUrl: "http://localhost:3001", error: null }}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
  await enterReferenceData();
}

describe("Your costs decisions", () => {
  it("shows observations, sources and the missing-input action list", async () => {
    await openReference();
    expect(await screen.findByTestId("cost-drivers")).toHaveTextContent(
      "largest cost",
    );
    expect(screen.getByTestId("data-sources")).toHaveTextContent(
      /Sources: \d+ reported/,
    );
    const missing = screen.getByRole("note", { name: "What is missing" });
    expect(
      within(missing).getAllByRole("link")[0].getAttribute("href"),
    ).toMatch(/^\/data#/);
  });

  it("compares a material change without saving it, hiding savings when costs are incomplete", async () => {
    await openReference();
    const panel = await screen.findByRole("region", {
      name: "Test a cost change",
    });
    fireEvent.change(
      within(panel).getByLabelText("New bag and label cost (€ per pack)"),
      { target: { value: "0,08" } },
    );
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Compare with my current costs",
      }),
    );
    const result = await within(panel).findByTestId("comparison");
    expect(result).toHaveTextContent("€286.00");
    expect(result).toHaveTextContent("€294.00");
    // Maintenance and other recurring costs are unknown: no savings claim.
    expect(within(panel).getByTestId("no-savings")).toBeInTheDocument();
    // The saved data is unchanged until the change is applied.
    expect(screen.getByTestId("operating-cost")).toHaveTextContent("€286.00");
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Apply this change to my data",
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("operating-cost")).toHaveTextContent("€294.00"),
    );
  });

  it("shows savings and payback once recurring costs are known", async () => {
    await openReference();
    // Fill the recurring costs in Edit data & costs.
    fireEvent.click(navLink(/Edit data & costs/));
    await screen.findByRole("heading", { name: "Edit data & costs" });
    for (const label of [
      "Machine maintenance (€ per month)",
      "Other recurring packaging costs (€ per month)",
    ])
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "0" },
      });
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes & update costs" }),
    );
    const panel = await screen.findByRole("region", {
      name: "Test a cost change",
    });
    fireEvent.change(
      within(panel).getByLabelText("What do you want to change?"),
      {
        target: { value: "machine" },
      },
    );
    fireEvent.change(within(panel).getByLabelText("Seconds per cycle"), {
      target: { value: "15" },
    });
    fireEvent.change(
      within(panel).getByLabelText("Purchase price (€, one-off)"),
      { target: { value: "500" } },
    );
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Compare with my current costs",
      }),
    );
    const savings = await within(panel).findByTestId("savings");
    expect(savings).toHaveTextContent("Net change in monthly running costs");
    expect(savings).toHaveTextContent("not a guaranteed saving");
  });

  it("decision brief shows results, sources and exports CSV", async () => {
    await openReference();
    fireEvent.click(navLink(/Decision brief/));
    expect(await screen.findByTestId("brief-total")).toHaveTextContent(
      "€286.00",
    );
    expect(
      screen.getByRole("button", { name: "Print / save as PDF" }),
    ).toBeEnabled();
    expect(screen.getByText("Inputs and sources")).toBeInTheDocument();
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});
