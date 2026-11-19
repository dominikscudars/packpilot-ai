import type { Quantity } from "../models/api";
import { assumed, reported } from "../../backend/src/domain/inputs";

/** A value OG TOFU gave us (or our labelled estimate), offered as a one-click fill. */
export interface Suggestion {
  value: string;
  estimate: boolean;
  quantity: () => Quantity;
}
const SOURCE = "OG TOFU interview, November 2026 (approximate).";
const fact = (value: string, note = SOURCE): Suggestion => ({
  value,
  estimate: false,
  quantity: () => reported(value, note),
});
const estimate = (value: string, note: string): Suggestion => ({
  value,
  estimate: true,
  quantity: () => assumed(value, note),
});

export const OG_TOFU = {
  monthlyProductionKg: fact("1000"),
  packs: [
    {
      grams: fact("1000"),
      share: fact(
        "80",
        "OG TOFU: about 80% of volume goes to restaurants in 1 kg packs.",
      ),
    },
    {
      grams: fact("500"),
      share: estimate(
        "15",
        "Estimate: OG TOFU has not reported its 500 g / 250 g split.",
      ),
    },
    {
      grams: fact("250"),
      share: estimate(
        "5",
        "Estimate: OG TOFU has not reported its 500 g / 250 g split.",
      ),
    },
  ],
  materialEuroPerPack: estimate(
    "0.07",
    "Midpoint of OG TOFU's reported €0.06–0.08 bag and label cost per pack.",
  ),
  laborEuroPerPack: fact("0.15"),
  cycleSeconds: fact("70"),
  packsPerCycle: fact("2"),
  operators: fact("1", "OG TOFU: one person does all the packing."),
};
