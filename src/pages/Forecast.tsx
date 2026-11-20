import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { parseTable } from "../survey/tabulate";
import { buildForecast } from "../forecast/forecast";
import { assumed } from "../../backend/src/domain/inputs";
import { decimalText } from "../components/ApiResults";
import {
  clearHistory,
  loadHistory,
  saveHistory,
} from "../forecast/historyStore";

const sizeLabel = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;

/** Made-up example (clearly labelled) so the tool can be tried at once. */
function exampleTable(sizes: number[]): string {
  const months = [
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
    "2026-10",
  ];
  const header = ["Month", ...sizes.map((g) => `${sizeLabel(g)} packs`)].join(
    "\t",
  );
  const rows = months.map((m, i) => {
    const kg = 820 + i * 45;
    return [
      m,
      ...sizes.map((g, j) => {
        const share = j === 0 ? 0.8 : j === 1 ? 0.15 : 0.05;
        return String(Math.round((kg * share * 1000) / g));
      }),
    ].join("\t");
  });
  return [header, ...rows].join("\n");
}

/** Tool: paste sales history from Excel and see a six-month forecast. */
export function Forecast() {
  const { baseline, setBaseline, saveScenario, scope } = useWorkspace();
  const [stored, setStored] = useState(() => loadHistory(scope));
  const [savedNote, setSavedNote] = useState("");
  const navigate = useNavigate();
  const formats = baseline.input.formats
    .map((f) => ({ id: f.id, grams: Number(f.portionWeightGrams.value) }))
    .filter((f) => f.grams > 0);
  const [pasted, setPasted] = useState(stored?.table ?? "");
  const [unit, setUnit] = useState<"packs" | "kg">(stored?.unit ?? "packs");
  const [example, setExample] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const result = useMemo(
    () => buildForecast(parseTable(pasted), formats, unit),
    [pasted, unit, JSON.stringify(formats)],
  );
  const next = result.forecast.at(0);
  const all = [
    ...result.history.map((r) => ({
      label: r.label,
      kg: r.totalKg,
      future: false,
    })),
    ...result.forecast.map((r) => ({
      label: r.label,
      kg: r.totalKg,
      future: true,
    })),
  ];
  const max = Math.max(1, ...all.map((p) => p.kg));
  const x = (i: number) => 40 + (i * 680) / Math.max(1, all.length - 1);
  const y = (kg: number) => 200 - (kg / max) * 160;
  const line = (points: typeof all, offset: number) =>
    points.map((p, i) => `${x(i + offset)},${y(p.kg)}`).join(" ");
  const historyCount = result.history.length;

  return (
    <>
      <header className="page-heading page-head">
        <div>
          <span className="eyebrow">Future forecasting</span>
          <h1>Sales history</h1>
          <p>
            Copy your monthly sales from Excel and paste them here. Saved
            history is used in Future forecasting on your workspace, so the
            forecast starts from what actually happened.
          </p>
          {stored && (
            <p className="muted" data-testid="history-saved">
              Sales history saved{" "}
              {new Date(stored.savedAt).toLocaleDateString("en-GB", {
                dateStyle: "medium",
              })}
              .{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  clearHistory(scope);
                  setStored(null);
                }}
              >
                Remove it
              </button>
            </p>
          )}
        </div>
      </header>

      <section className="panel">
        <h2>Your sales history</h2>
        <p className="muted">
          One row per month. First column: the month (e.g. 2026-10). Then one
          column per pack size with a heading such as “1 kg”, “500 g” or “250
          g”. Your pack sizes:{" "}
          {formats.map((f) => sizeLabel(f.grams)).join(", ")}.
        </p>
        <label>
          Paste from Excel or Google Sheets
          <textarea
            rows={6}
            value={pasted}
            placeholder={"Month\t1 kg\t500 g\t250 g\n2026-09\t800\t300\t200"}
            onChange={(e) => {
              setPasted(e.target.value);
              setExample(false);
            }}
          />
        </label>
        <div className="step-actions">
          <label className="file-input">
            …or upload a .csv file
            <input
              type="file"
              accept=".csv,text/csv,.tsv,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPasted(await file.text());
                setExample(false);
              }}
            />
          </label>
          <label>
            The numbers are
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as "packs" | "kg")}
            >
              <option value="packs">packs sold</option>
              <option value="kg">kg sold</option>
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setPasted(exampleTable(formats.map((f) => f.grams)));
              setUnit("packs");
              setExample(true);
            }}
          >
            Try with example data
          </button>
        </div>
        {example && (
          <p className="notice">
            Example data, made up to show the tool. It is not real sales and
            cannot be saved as your history.
          </p>
        )}
        {result.unmatched.length > 0 && (
          <p className="notice">
            Columns not matched to one of your pack sizes were ignored:{" "}
            {result.unmatched.join(", ")}.
          </p>
        )}
      </section>

      {historyCount > 0 && next && (
        <section className="panel" aria-live="polite">
          <h2>Forecast</h2>
          <p data-testid="forecast-summary">
            Trend:{" "}
            <strong>
              {result.trendKgPerMonth >= 0 ? "+" : ""}
              {decimalText(result.trendKgPerMonth, 0)} kg per month
            </strong>
            . Next month ({next.label}): about{" "}
            <strong>{decimalText(next.totalKg, 0)} kg</strong>; in six months
            about {decimalText(result.forecast.at(-1)?.totalKg ?? 0, 0)} kg.
          </p>
          <svg
            viewBox="0 0 760 240"
            role="img"
            aria-label="Monthly kg sold and forecast"
            className="forecast-chart"
          >
            <line x1="40" x2="720" y1="200" y2="200" stroke="#cfd6e6" />
            <line x1="40" x2="720" y1="40" y2="40" stroke="#eef1f8" />
            <text x="36" y="44" fontSize="11" textAnchor="end" fill="#64718a">
              {decimalText(max, 0)}
            </text>
            <text x="36" y="204" fontSize="11" textAnchor="end" fill="#64718a">
              0
            </text>
            <polyline
              points={line(all.slice(0, historyCount), 0)}
              fill="none"
              stroke="#5263eb"
              strokeWidth="3"
            />
            <polyline
              points={line(all.slice(historyCount - 1), historyCount - 1)}
              fill="none"
              stroke="#5263eb"
              strokeWidth="3"
              strokeDasharray="6 6"
              opacity="0.6"
            />
            {all.map((p, i) => (
              <g key={`${p.label}-${i}`}>
                <circle
                  cx={x(i)}
                  cy={y(p.kg)}
                  r="4"
                  fill={p.future ? "#9aa8e8" : "#5263eb"}
                >
                  <title>{`${p.label}: ${Math.round(p.kg)} kg${p.future ? " (forecast)" : ""}`}</title>
                </circle>
                {(i === 0 ||
                  i === historyCount - 1 ||
                  i === all.length - 1) && (
                  <text
                    x={x(i)}
                    y="225"
                    textAnchor="middle"
                    fontSize="12"
                    fill="#64718a"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            ))}
            <text x="40" y="22" fontSize="12" fill="#64718a">
              kg per month · solid: your sales · dashed: forecast
            </text>
          </svg>
          <p>
            Pack mix over the last three months:{" "}
            {formats
              .filter((f) => result.shares[f.id] !== undefined)
              .map((f) => `${sizeLabel(f.grams)} ${result.shares[f.id]}%`)
              .join(" · ")}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="step-actions">
            <button
              type="button"
              disabled={example || result.history.length < 3}
              onClick={() => {
                if (saveHistory(scope, unit, pasted)) {
                  setStored(loadHistory(scope));
                  setSavedNote(
                    "Saved. Future forecasting on your workspace now uses this history.",
                  );
                } else
                  setSavedNote(
                    "This browser blocked saving; the history could not be kept.",
                  );
              }}
            >
              Save as my sales history
            </button>
            {result.history.length < 3 && (
              <span className="muted">At least three months are needed.</span>
            )}
          </div>
          {savedNote && (
            <p role="status" className="muted">
              {savedNote}
            </p>
          )}
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              const note = example
                ? "Forecast from example data (made up)."
                : "Forecast from imported sales history (straight-line trend).";
              const input = {
                ...baseline.input,
                monthlyProductionKg: assumed(String(next.totalKg), note),
                formats: baseline.input.formats.map((f) =>
                  result.shares[f.id] === undefined
                    ? f
                    : {
                        ...f,
                        allocationPercent: assumed(
                          String(result.shares[f.id]),
                          "Average pack mix of the last three months imported.",
                        ),
                      },
                ),
              };
              try {
                const saved = await saveScenario(
                  {
                    ...baseline,
                    input,
                  },
                  baseline.id === null,
                );
                setBaseline(saved);
                navigate("/");
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Use next month's forecast in my data →"}
          </button>
        </section>
      )}
    </>
  );
}
