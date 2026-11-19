import { Link } from "react-router-dom";
import type { PackagingCostResult, ScenarioInput } from "../models/api";
import { Icon, type IconName } from "./Icon";
import { decimalText, money } from "./ApiResults";

interface Card {
  to: string;
  icon: IconName;
  title: string;
  text: string;
  action: string;
}

/** "What you can do next" cards, personalised with the company's results. */
export function FeatureCards({
  result,
  input,
}: {
  result: PackagingCostResult;
  input: ScenarioInput;
}) {
  const perKg = result.rows
    .map((row) => ({
      grams: Number(
        input.formats.find((f) => f.id === row.formatId)?.portionWeightGrams
          .value,
      ),
      euroPerKg: row.packagingEuroPerPackedKg,
    }))
    .filter((r) => r.grams > 0 && r.euroPerKg !== null)
    .sort((a, b) => a.grams - b.grams);
  const smallest = perKg.at(0);
  const largest = perKg.at(-1);
  const gap =
    smallest && largest && smallest.grams !== largest.grams
      ? ` Your ${smallest.grams} g packs cost ${money(smallest.euroPerKg, 2)}/kg to pack, against ${money(largest.euroPerKg, 2)} for ${largest.grams >= 1000 ? `${largest.grams / 1000} kg` : `${largest.grams} g`}.`
      : "";
  const cards: Card[] = [
    {
      to: "/advisor",
      icon: "spark",
      title: "Market research",
      text: `Find machines, materials and suppliers that lower your ${money(result.packagingEuroPerPlannedKg, 3)} per kg, and check EU packaging rules.${gap}`,
      action: "Start research",
    },
    {
      to: "/forecast",
      icon: "chart",
      title: "Sales forecast",
      text: "Paste your sales from Excel and see the next six months, then update these costs in one click.",
      action: "Open forecast",
    },
    {
      to: "/reorder",
      icon: "box",
      title: "Stock & orders",
      text: `You use about ${decimalText(result.totalPackages, 0)} bags and labels a month. Count your stock and get a ready order list.`,
      action: "Plan orders",
    },
    {
      to: "/survey",
      icon: "survey",
      title: "Customer survey",
      text: `Ask customers which of your ${perKg.length || input.formats.length} pack sizes and prices they prefer, then use the answers in market research.`,
      action: "Create survey",
    },
  ];
  return (
    <section className="feature-hub" aria-label="What you can do next">
      <h2>What you can do next</h2>
      <div className="feature-grid">
        {cards.map((card) => (
          <Link key={card.to} to={card.to} className="feature-card">
            <span className="feature-icon">
              <Icon name={card.icon} />
            </span>
            <strong>{card.title}</strong>
            <span className="feature-text">{card.text}</span>
            <span className="feature-action">
              {card.action} <Icon name="arrow" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
