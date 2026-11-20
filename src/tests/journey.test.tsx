import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { assumed } from "../../backend/src/domain/inputs";
import { DEMO_COMPANY_ID, DEMO_KEY } from "../demo/apiDemo";
import {
  loadSetupRecord,
  loadSkipped,
  saveSkipped,
  scopeKey,
} from "../setup/setupState";
import { NO_CHANGE, capacityLimit, project } from "../forecast/projection";
import { enterReferenceData, navLink, type } from "./journey";

const SCOPE = scopeKey("demo", null, DEMO_COMPANY_ID);
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App
        services={{ auth: null, apiUrl: "http://localhost:3001", error: null }}
      />
    </MemoryRouter>,
  );
}
async function open(path = "/") {
  const view = mount(path);
  const button = screen.queryByRole("button", { name: "Open local demo" });
  if (button) fireEvent.click(button);
  await screen.findByRole("heading", {
    name: /^(Enter your data|Your workspace|Customer survey|Market research|Decision brief)$/,
  });
  return view;
}

describe("example company", () => {
  it("loads the labelled OG TOFU pilot profile and opens the workspace", async () => {
    await open();
    fireEvent.click(
      screen.getByRole("button", { name: "Load example company (OG TOFU)" }),
    );
    expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
      "€286.00",
    );
    expect(screen.getByTestId("example-profile")).toHaveTextContent(
      "Example pilot profile (OG TOFU)",
    );
    expect(loadSetupRecord(SCOPE)).not.toBeNull();
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}");
    expect(saved.company.name).toBe("OG TOFU");
    // Unknown recurring costs stay unknown, never €0.
    expect(
      saved.catalog.scenarios[0].input.machines[0].maintenanceEuroPerMonth
        .value,
    ).toBeNull();
    expect(
      saved.catalog.scenarios[0].input.additionalOperatingEuroPerMonth.value,
    ).toBeNull();
  });
});

describe("skip journey", () => {
  it("opens an empty workspace without any calculated or sample figures", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await screen.findByRole("heading", { name: "Your workspace" });
    expect(screen.getByRole("heading", { name: "Your costs" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Future forecasting" }),
    ).toBeVisible();
    expect(screen.getByText("No costs yet")).toBeInTheDocument();
    expect(screen.getByText("No forecast yet")).toBeInTheDocument();
    expect(screen.queryByTestId("operating-cost")).toBeNull();
    // No euro amount or OG TOFU figure anywhere in the workspace.
    expect(screen.getByRole("main").textContent).not.toMatch(/€\s?\d/);
    expect(screen.getByRole("main").textContent).not.toMatch(/OG TOFU/);
    expect(loadSkipped(SCOPE)).toBe(true);
    expect(loadSetupRecord(SCOPE)).toBeNull();
  });

  it("keeps the skipped state across refreshes and direct links", async () => {
    saveSkipped(SCOPE);
    const view = await open("/brief");
    // Tools that need company data explain it instead of showing results.
    expect(
      await screen.findByText("Enter your data first"),
    ).toBeInTheDocument();
    view.unmount();
    await open("/data");
    // Editing before any data exists is the onboarding form itself.
    expect(
      await screen.findByRole("heading", { name: "Enter your data" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Finish setting up")).toBeInTheDocument();
  });

  it("can enter data later and then shows costs", async () => {
    saveSkipped(SCOPE);
    await open("/");
    fireEvent.click(
      screen.getAllByRole("link", { name: "Enter your data" })[0],
    );
    await enterReferenceData();
    expect(screen.getByTestId("operating-cost")).toHaveTextContent("€286.00");
    expect(loadSkipped(SCOPE)).toBe(false);
  });
});

describe("returning users and direct links", () => {
  it("go straight to the workspace or the linked page once data is saved", async () => {
    const view = await open("/");
    await enterReferenceData();
    view.unmount();
    // Same tab after a refresh: no entry screen, no onboarding.
    const again = await open("/survey");
    expect(
      await screen.findByRole("heading", { name: "Customer survey" }),
    ).toBeInTheDocument();
    again.unmount();
    await open("/welcome");
    expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
      "€286.00",
    );
  });

  it("never prefills a new demo with stored OG TOFU data", async () => {
    localStorage.setItem("packpilot.demo.v2", '{"company":{"name":"OG TOFU"}}');
    await open("/");
    expect(
      screen.getByLabelText("How many kilograms do you produce per month?"),
    ).toHaveValue("");
    // OG TOFU is only named in the opt-in "Load example company" offer.
    for (const el of screen.queryAllByText(/OG TOFU/))
      expect(el.closest(".example-offer")).not.toBeNull();
    expect(localStorage.getItem(DEMO_KEY)).toBeNull();
  });
});

describe("editing updates costs and forecasts", () => {
  it("recalculates Your costs and the projection after saving an edit", async () => {
    await open("/");
    await enterReferenceData();
    type("Production change", "100");
    expect(screen.getByTestId("projection-summary")).toHaveTextContent(
      "€572 a month (now €286)",
    );
    fireEvent.click(navLink(/Edit data & costs/));
    type("Bag and label cost (€ per pack) · pack size 1", "0.08");
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes & update costs" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("operating-cost")).toHaveTextContent("€294.00"),
    );
    // The forecast now starts from the edited data.
    expect(screen.getByTestId("projection-summary")).toHaveTextContent(
      "No change assumed: your cost stays at €294",
    );
  });
});

describe("projection maths", () => {
  const input = createDemoScenario();
  const start = new Date(Date.UTC(2026, 10, 1));
  it("is flat with no assumptions and follows the engine exactly", () => {
    const points = project(input, NO_CHANGE, start);
    expect(points).toHaveLength(13);
    expect(points[0]).toMatchObject({ label: "Now", costEuro: 286 });
    expect(points.at(-1)).toMatchObject({ label: "Nov 27", costEuro: 286 });
  });
  it("ramps production and prices linearly to the horizon", () => {
    const points = project(
      input,
      { ...NO_CHANGE, productionChangePct: 100, materialChangePct: 10 },
      start,
    );
    // 2,000 kg → 2,600 packs × (€0.077 + €0.15) = €590.20
    expect(points.at(-1)?.productionKg).toBe(2000);
    expect(points.at(-1)?.costEuro).toBeCloseTo(590.2, 6);
    expect(points[6]?.productionKg).toBe(1500);
  });
  it("finds the first month above available machine hours", () => {
    const limited = createDemoScenario();
    limited.machines[0].availableHoursPerMonth = assumed("20", "test");
    const points = project(
      limited,
      { ...NO_CHANGE, productionChangePct: 100 },
      start,
    );
    const limit = capacityLimit(limited, points);
    expect(limit.available).toBe(20);
    expect(limit.first?.machineHours).toBeGreaterThan(20);
    expect(capacityLimit(input, points).available).toBeNull();
  });
});
