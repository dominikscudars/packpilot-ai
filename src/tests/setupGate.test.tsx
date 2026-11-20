import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import App from "../App";
import type { AppServices } from "../components/AuthGate";
import { authFixture, apiFixture, json } from "./integrationFixture";
import { DEMO_COMPANY_ID, DEMO_KEY } from "../demo/apiDemo";
import { enterReferenceData, navLink } from "./journey";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { assumed, missing } from "../../backend/src/domain/inputs";
import {
  loadSetupRecord,
  saveSetupRecord,
  scopeKey,
  setupProblems,
} from "../setup/setupState";

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
const demo: AppServices = {
  auth: null,
  apiUrl: "http://localhost:3001",
  error: null,
};
function mount(path: string, services: AppServices = demo) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App services={services} />
    </MemoryRouter>,
  );
}
async function openDemo(path = "/") {
  const view = mount(path);
  fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
  await screen.findByLabelText("Active company");
  return view;
}
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const completeOgSetup = () => enterReferenceData();

describe("onboarding gate", () => {
  it.each([
    "/",
    "/advisor",
    "/forecast",
    "/reorder",
    "/survey",
    "/company",
    "/inventory",
    "/simulator",
    "/no-such-page",
  ])("a fresh demo at %s shows only setup", async (path) => {
    await openDemo(path);
    expect(
      await screen.findByRole("heading", { name: "Enter your data" }),
    ).toBeInTheDocument();
    // Full screen: no workspace navigation, results or research tools.
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).toBeNull();
    expect(screen.queryByTestId("operating-cost")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Your costs" })).toBeNull();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeEnabled();
    // Leaving stays possible: Exit demo and Reset demo remain.
    expect(screen.getByRole("button", { name: "Exit demo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeEnabled();
  });

  it("does not unlock from a corrupt or mismatched setup record", async () => {
    localStorage.setItem("packpilot.setup.v1", "{not json");
    await openDemo("/forecast");
    expect(
      await screen.findByRole("heading", { name: "Enter your data" }),
    ).toBeInTheDocument();
    // A well-formed record pointing to a scenario that does not exist.
    localStorage.setItem(
      "packpilot.setup.v1",
      JSON.stringify({
        [scopeKey("demo", null, DEMO_COMPANY_ID)]: {
          version: 1,
          scenarioId: "missing-scenario",
          completedAt: "2026-11-19T00:00:00Z",
        },
      }),
    );
    expect(
      loadSetupRecord(scopeKey("demo", null, DEMO_COMPANY_ID)),
    ).not.toBeNull();
  });

  it("keeps working when browser storage is blocked", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("Blocked");
      });
    try {
      await openDemo("/survey");
      await completeOgSetup();
      expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
        "€286.00",
      );
    } finally {
      getItem.mockRestore();
    }
  });

  it("a failed save keeps the draft and does not unlock insights", async () => {
    const { auth } = authFixture();
    const { fetcher } = apiFixture();
    const normal = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/scenarios") && init?.method === "GET")
        return json([]); // company without saved data: setup is required
      if (path.includes("/scenarios")) return json("Database unavailable", 500);
      return normal(url, init);
    });
    mount("/advisor", {
      auth,
      apiUrl: "http://localhost:3001",
      error: null,
      fetcher,
    });
    await screen.findByRole("heading", { name: "Enter your data" });
    // The company's own pack-size records start the form; keep only one.
    for (const n of [3, 2])
      fireEvent.click(
        screen.getByRole("button", { name: `Remove pack size ${n}` }),
      );
    change("How many kilograms do you produce per month?", "1000");
    change("Pack weight (g) · pack size 1", "1000");
    change("Share of production (%) · pack size 1", "100");
    for (const next of ["Packaging materials", "Labour & capacity", "Review"]) {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: next });
    }
    fireEvent.click(screen.getByRole("button", { name: "Show my workspace" }));
    expect(await screen.findByText(/Saving failed/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Enter your data" }),
    ).toBeInTheDocument();
    // The answers stay; going back to step 1 shows them unchanged.
    fireEvent.click(screen.getByRole("button", { name: "Edit Production" }));
    expect(
      screen.getByLabelText("How many kilograms do you produce per month?"),
    ).toHaveValue("1000");
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).toBeNull();
  });
});

describe("edit data & costs loop", () => {
  it("recalculates on save, reverts exactly, and discards unsaved drafts", async () => {
    await openDemo();
    await completeOgSetup();
    expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
      "€286.00",
    );
    expect(screen.getByTestId("total-packages")).toHaveTextContent("1,300");

    // Change only the 1 kg material cost to €0.08 → €294.
    fireEvent.click(navLink(/Edit data & costs/));
    await screen.findByRole("heading", { name: "Edit data & costs" });
    change("Bag and label cost (€ per pack) · pack size 1", "0.08");
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes & update costs" }),
    );
    expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
      "€294.00",
    );

    // Revert to €0.07 → exactly €286 again.
    fireEvent.click(navLink(/Edit data & costs/));
    change("Bag and label cost (€ per pack) · pack size 1", "0.07");
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes & update costs" }),
    );
    expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
      "€286.00",
    );

    // An unsaved draft survives navigation, and Discard restores the saved value.
    fireEvent.click(navLink(/Edit data & costs/));
    change("How many kilograms do you produce per month?", "2000");
    fireEvent.click(navLink(/Workspace/));
    expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
      "€286.00",
    );
    fireEvent.click(navLink(/Edit data & costs/));
    expect(
      screen.getByLabelText("How many kilograms do you produce per month?"),
    ).toHaveValue("2000");
    expect(screen.getByText(/You have unsaved changes\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(
      screen.getByLabelText("How many kilograms do you produce per month?"),
    ).toHaveValue("1000");
  });

  it("Reset demo clears data and readiness", async () => {
    await openDemo();
    await completeOgSetup();
    expect(localStorage.getItem(DEMO_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(
      await screen.findByRole("button", { name: "Open local demo" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(DEMO_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
    expect(
      await screen.findByRole("heading", { name: "Enter your data" }),
    ).toBeInTheDocument();
  });
});

describe("setup rules", () => {
  const valid = () => createDemoScenario();
  it("accepts the reference, zero production and unknown costs", () => {
    expect(setupProblems(valid())).toEqual([]);
    const zero = valid();
    zero.monthlyProductionKg = assumed("0", "test");
    expect(setupProblems(zero)).toEqual([]);
    const unknown = valid();
    unknown.formats[0].materialCost = {
      method: "combined",
      combinedEuroPerPackage: missing(),
    };
    unknown.labor = { method: "perPackage", euroPerPackage: missing() };
    expect(setupProblems(unknown)).toEqual([]);
  });
  it("names the field for each problem", () => {
    const s = valid();
    s.monthlyProductionKg = missing();
    s.formats[0].allocationPercent = assumed("70", "test");
    s.formats[1].portionWeightGrams = assumed("0", "test");
    s.formats[2].machineId = "nope";
    expect(setupProblems(s).map((p) => p.field)).toEqual([
      "field-production",
      "field-format-1-grams",
      "field-machine",
      "field-shares-total",
    ]);
    const dup = valid();
    dup.formats[1].id = dup.formats[0].id;
    expect(setupProblems(dup).map((p) => p.field)).toContain("field-formats");
  });
  it("scopes readiness by mode, user and company", () => {
    saveSetupRecord(scopeKey("demo", null, DEMO_COMPANY_ID), "s1");
    expect(
      loadSetupRecord(scopeKey("demo", null, DEMO_COMPANY_ID)),
    ).not.toBeNull();
    expect(loadSetupRecord(scopeKey("demo", null, "other"))).toBeNull();
    expect(
      loadSetupRecord(scopeKey("authenticated", "user-a", "og-tofu")),
    ).toBeNull();
  });
});
