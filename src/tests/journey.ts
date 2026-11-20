import { fireEvent, screen, within } from "@testing-library/react";

/**
 * Test helpers for the onboarding → workspace journey. The OG TOFU reference
 * values are typed in by the "visitor" exactly as a company would: the app
 * itself never prefills them.
 */
export const OG_TOFU_INPUT = {
  production: "1000",
  packs: [
    { grams: "1000", share: "80" },
    { grams: "500", share: "15" },
    { grams: "250", share: "5" },
  ],
  material: "0.07",
  labour: "0.15",
  cycleSeconds: "70",
  packsPerCycle: "2",
  operators: "1",
};

export const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

/** Fills the three onboarding steps with OG TOFU's reference data. */
export async function fillReferenceSteps(data = OG_TOFU_INPUT) {
  await screen.findByRole("heading", { name: "Enter your data" });
  type("How many kilograms do you produce per month?", data.production);
  data.packs.forEach((pack, i) => {
    if (i > 0) click("+ Add pack size");
    type(`Pack weight (g) · pack size ${i + 1}`, pack.grams);
    type(`Share of production (%) · pack size ${i + 1}`, pack.share);
  });
  click("Continue");
  await screen.findByRole("heading", { name: "Packaging materials" });
  data.packs.forEach((_, i) =>
    type(`Bag and label cost (€ per pack) · pack size ${i + 1}`, data.material),
  );
  click("Continue");
  await screen.findByRole("heading", { name: "Labour & capacity" });
  type("Labour cost (€ per pack)", data.labour);
  type("Seconds per machine cycle", data.cycleSeconds);
  type("Packs sealed per cycle", data.packsPerCycle);
  type("People operating the machine", data.operators);
  click("Continue");
  await screen.findByRole("heading", { name: "Review" });
}

/** Completes onboarding with the reference data and waits for Your costs. */
export async function enterReferenceData(data = OG_TOFU_INPUT) {
  await fillReferenceSteps(data);
  click("Show my workspace");
  await screen.findByTestId("operating-cost");
}

/** A link in the workspace header (main navigation or the tools menu). */
export function navLink(name: RegExp) {
  return within(
    screen.getByRole("navigation", { name: "Main navigation" }),
  ).getByRole("link", { name });
}

export const NAV: Record<string, RegExp> = {
  "/company": /Company profile/,
  "/research": /Market research/,
  "/advisor": /Market research/,
  "/survey": /Customer survey/,
  "/brief": /Decision brief/,
  "/data": /Edit data & costs/,
};
