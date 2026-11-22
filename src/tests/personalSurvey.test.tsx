import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { personalSurvey, surveyContext } from "../survey/personal";
import { enterReferenceData, navLink } from "./journey";

const og = (prices = {}) =>
  surveyContext(createDemoScenario(), "OG TOFU", "fresh tofu", prices);
const ids = (qs: { id: string }[]) => qs.map((q) => q.id);

describe("personalised survey", () => {
  it("uses the company's own pack-size costs and biggest saving", () => {
    const qs = personalSurvey(og(), ["packs"], "consumers", "full");
    const pref = qs.find((q) => q.id === "pack-preference")!;
    expect(pref.options).toEqual([
      "250 g",
      "500 g",
      "1 kg",
      "Depends on the price per kg",
    ]);
    expect(pref.why).toBe(
      "Your 250 g packs cost 4.0× more per kg to pack than 1 kg packs.",
    );
    const sw = qs.find((q) => q.id === "switch")!;
    expect(sw.title).toBe(
      "If fresh tofu came in 1 kg packs at a lower price per kg, would you buy those instead of 250 g?",
    );
    expect(sw.why).toContain("saves you about €33.00 a month");
  });

  it("tests real shelf prices and sizes price options around them", () => {
    const qs = personalSurvey(
      og({ 1000: 4, 500: 2.25, 250: 1.25 }),
      ["price"],
      "consumers",
      "full",
    );
    expect(qs.find((q) => q.id === "price-choice")!.options).toEqual([
      "250 g — €1.25 (€5.00/kg)",
      "500 g — €2.25 (€4.50/kg)",
      "1 kg — €4.00 (€4.00/kg)",
    ]);
    expect(qs.find((q) => q.id === "price-max")!.options).toEqual([
      "Under €3.50",
      "€3.50–€4.00",
      "€4.00–€4.50",
      "More than €4.50",
    ]);
  });

  it("scales green-packaging options to the bag and label cost", () => {
    const q = personalSurvey(og(), ["packaging"], "consumers", "full").find(
      (x) => x.id === "recycle-pay",
    )!;
    expect(q.options[1]).toBe("Up to €0.04 more per pack");
    expect(q.why).toContain("€0.070 per pack");
  });

  it("writes different questions for shops and restaurants", () => {
    const shops = ids(
      personalSurvey(og(), ["packs", "price"], "shops", "full"),
    );
    expect(shops).toEqual(
      expect.arrayContaining(["shop-sellers", "shop-large", "shop-margin"]),
    );
    expect(shops).not.toContain("pack-preference");
    const kitchens = personalSurvey(og(), ["packs"], "restaurants", "full");
    expect(kitchens.find((q) => q.id === "horeca-pack")!.options).toContain(
      "5 kg",
    );
  });

  it("keeps a short survey to six questions or fewer", () => {
    const all = ["packs", "price", "packaging", "new"] as const;
    const full = personalSurvey(
      og({ 1000: 4, 250: 1.25 }),
      [...all],
      "consumers",
      "full",
    );
    const short = personalSurvey(
      og({ 1000: 4, 250: 1.25 }),
      [...all],
      "consumers",
      "short",
    );
    expect(short.length).toBeLessThanOrEqual(6);
    expect(full.length).toBeGreaterThan(short.length);
  });
});

describe("survey builder conversation", () => {
  it("asks a few questions and writes a survey from the company's data", async () => {
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
    fireEvent.click(navLink(/Customer survey/));
    const builder = await screen.findByRole("region", {
      name: "Survey builder",
    });
    fireEvent.change(within(builder).getByLabelText("Product"), {
      target: { value: "fresh tofu" },
    });
    fireEvent.click(within(builder).getByRole("button", { name: "Continue" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Which pack sizes to sell" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Greener or different packaging" }),
    );
    fireEvent.click(within(builder).getByRole("button", { name: "Continue" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Shoppers who buy it" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Full (about 5 minutes)" }),
    );
    const list = screen.getByTestId("survey-questions");
    expect(list).toHaveTextContent(
      "Which pack size would you prefer for regular use?",
    );
    expect(list).toHaveTextContent(
      "Why: Your 250 g packs cost 4.0× more per kg to pack than 1 kg packs.",
    );
    expect(list).toHaveTextContent(
      "Would you pay more for packaging that is easier to recycle?",
    );
    // The user's answers stay visible as chat bubbles.
    expect(builder).toHaveTextContent("Shoppers who buy it");
    // Questions can be removed.
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove: Which pack size would you prefer for regular use?",
      }),
    );
    expect(screen.getByTestId("survey-questions")).not.toHaveTextContent(
      "Which pack size would you prefer for regular use?",
    );
  });
});
