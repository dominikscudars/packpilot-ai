import type { ScenarioInput } from "../models/api";
import { optimisations } from "../forecast/optimise";

const euro = (v: number, digits = 2) =>
  `€${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/**
 * An answer PackPilot can always give, without any AI service: the savings
 * its own engine calculates from the company's data. Used when live
 * research is busy, out of free quota or not set up.
 */
export function quickAnswer(input: ScenarioInput): string | null {
  let result: ReturnType<typeof optimisations>;
  try {
    result = optimisations(input);
  } catch {
    return null;
  }
  const { options, base } = result;
  if (!options.length) return null;
  const saving = options.filter((o) => (o.savingEuro ?? 0) > 0.004);
  const top = saving[0] ?? options[0];
  const lines: string[] = [];
  lines.push("## Recommendation");
  lines.push(
    saving.length
      ? `From your own numbers, the biggest saving PackPilot can calculate is to **${top.title.toLowerCase()}**: about ${euro(top.savingEuro ?? 0)} a month${
          base.cost ? ` on your ${euro(base.cost)}` : ""
        }.`
      : `From your own numbers, the main lever is to **${top.title.toLowerCase()}**.`,
  );
  lines.push("", "## What you could change");
  for (const o of options.slice(0, 4)) {
    const effects: string[] = [];
    if ((o.savingEuro ?? 0) > 0.004)
      effects.push(`saves about ${euro(o.savingEuro!)} a month`);
    if (
      o.euroPerKg.from !== null &&
      o.euroPerKg.to !== null &&
      o.euroPerKg.to < o.euroPerKg.from - 0.0004
    )
      effects.push(
        `${euro(o.euroPerKg.from, 3)} → ${euro(o.euroPerKg.to, 3)} per kg`,
      );
    if (
      o.machineHours.from !== null &&
      o.machineHours.to !== null &&
      o.machineHours.from - o.machineHours.to > 0.05
    )
      effects.push(
        `${(o.machineHours.from - o.machineHours.to).toFixed(1)} h less machine time a month`,
      );
    lines.push(
      `- **${o.title}**: ${o.why}${effects.length ? ` (${effects.join(", ")})` : ""}`,
    );
  }
  lines.push("", "## Assumptions and trade-offs");
  lines.push(
    ...options.slice(0, 4).map((o) => `- ${o.title}: ${o.assumption}`),
  );
  lines.push("", "## Next steps");
  lines.push(
    "- Try the change that suits you in **Test a cost change** on your workspace.",
    "- Ask again later for live web research on prices, suppliers and machines.",
  );
  return lines.join("\n");
}
