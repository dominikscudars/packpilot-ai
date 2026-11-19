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
      title: "Research alternatives",
      text: `Machines, materials and suppliers that could lower your ${money(result.packagingEuroPerPlannedKg, 3)} per kg, with sources, plus EU packaging rules.${gap}`,
      action: "Start research",
    },
    {
      to: "#test-change",
      icon: "simulator",
      title: "Test a cost change",
      text: "Try a new material price, wage, production level or machine and compare it with today, without changing your data.",
      action: "Test a change",
    },
    {
      to: "/reorder",
      icon: "box",
      title: "Plan stock",
      text: `You use about ${decimalText(result.totalPackages, 0)} bags and labels a month. Count your stock and get a ready order list.`,
      action: "Plan orders",
    },
    {
      to: "/forecast",
      icon: "chart",
      title: "Review demand",
      text: "Paste your monthly sales from Excel to see the trend for the next six months.",
      action: "Open forecast",
    },
    {
      to: "/survey",
      icon: "survey",
      title: "Use customer feedback",
      text: `Ask customers which of your ${perKg.length || input.formats.length} pack sizes and prices they prefer, then use the answers in research.`,
      action: "Create survey",
    },
  ];
  return (
    <section className="feature-hub" aria-label="Next actions">
      <h2>Next actions</h2>
      <div className="feature-grid">
        {cards.map((card) => {
          const body = (
            <>
              <span className="feature-icon">
                <Icon name={card.icon} />
              </span>
              <strong>{card.title}</strong>
              <span className="feature-text">{card.text}</span>
              <span className="feature-action">
                {card.action} <Icon name="arrow" />
              </span>
            </>
          );
          return card.to.startsWith("#") ? (
            <a
              key={card.to}
              href={card.to}
              className="feature-card"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(card.to.slice(1))?.scrollIntoView?.();
                document
                  .querySelector<HTMLElement>(`${card.to} select`)
                  ?.focus();
              }}
            >
              {body}
            </a>
          ) : (
            <Link key={card.to} to={card.to} className="feature-card">
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
