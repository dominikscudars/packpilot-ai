import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { buildSurvey, surveyText } from "../survey/questions";
import { parseTable, summaryText, tabulate } from "../survey/tabulate";
import { saveSurvey } from "../survey/surveyStore";

/** OG TOFU's test prices from its own consumer survey (demo only). */
const OG_TEST_PRICES: Record<number, number> = {
  1000: 4,
  500: 2.25,
  250: 1.25,
};

const sizeLabel = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;

/** Tool: write a customer survey for Google Forms and analyse the answers. */
export function Survey() {
  const { baseline, catalog, company, mode } = useWorkspace();
  const navigate = useNavigate();
  const sizes = baseline.input.formats
    .map((f) => Number(f.portionWeightGrams.value))
    .filter((g) => g > 0);
  const [product, setProduct] = useState(
    catalog.products.at(0)?.name ?? "our product",
  );
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [fileError, setFileError] = useState("");

  const questions = buildSurvey({
    product,
    brand: company.name,
    sizes,
    prices: Object.fromEntries(
      Object.entries(prices).map(([g, p]) => [
        Number(g),
        Number(p) || undefined,
      ]),
    ),
  });
  const text = surveyText(questions);
  const results = useMemo(() => tabulate(parseTable(pasted)), [pasted]);

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">TOOL</span>
          <h1>Customer survey</h1>
          <p>
            Ask your customers which pack sizes and prices they want. PackPilot
            writes the questions from your pack sizes; you put them into Google
            Forms, share the link, and paste the answers back here for the
            market research assistant.
          </p>
        </div>
      </header>

      <section className="panel">
        <h2>1. Create your survey</h2>
        <div className="form-grid">
          <label>
            Product name
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            />
          </label>
          {sizes.map((g) => (
            <label key={g}>
              {`Shelf price for ${sizeLabel(g)} (€, optional)`}
              <input
                inputMode="decimal"
                value={prices[g] ?? ""}
                placeholder="e.g. 2.25"
                onChange={(e) => setPrices({ ...prices, [g]: e.target.value })}
              />
              {mode === "demo" &&
                OG_TEST_PRICES[g] !== undefined &&
                !prices[g] && (
                  <button
                    type="button"
                    className="suggestion-chip"
                    aria-label={`Use ${OG_TEST_PRICES[g]} – OG TOFU survey price for ${sizeLabel(g)}`}
                    onClick={() =>
                      setPrices({ ...prices, [g]: String(OG_TEST_PRICES[g]) })
                    }
                  >
                    {OG_TEST_PRICES[g].toFixed(2)} – OG TOFU survey price
                  </button>
                )}
            </label>
          ))}
        </div>
        <p className="muted">
          With prices for at least two sizes, the survey also asks which pack
          customers would choose at those prices.
        </p>
        <ol className="survey-preview" data-testid="survey-questions">
          {questions.map((q) => (
            <li key={q.title}>
              <strong>{q.title}</strong>
              {q.options.length > 0 && <span> — {q.options.join(" / ")}</span>}
            </li>
          ))}
        </ol>
        <div className="step-actions">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(text)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? "Copied" : "Copy questions"}
          </button>
          <a
            className="button secondary"
            href="https://forms.new"
            target="_blank"
            rel="noreferrer"
          >
            Open a new Google Form
          </a>
        </div>
        <details className="reorder-more">
          <summary>How to make the Google Form (about 2 minutes)</summary>
          <ol>
            <li>
              Click “Open a new Google Form” (sign in with Google if asked).
            </li>
            <li>
              For each question, add it with the type shown in brackets, then
              paste the answer options; Google Forms turns each line into one
              option.
            </li>
            <li>Click “Send” and share the link with your customers.</li>
            <li>
              When answers are in, open the “Responses” tab, click “Link to
              Sheets”, then copy the whole sheet (or download it as .csv) and
              paste it below.
            </li>
          </ol>
        </details>
      </section>

      <section className="panel">
        <h2>2. Analyse the answers</h2>
        <label>
          Paste your responses (copied from Google Sheets or Excel)
          <textarea
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Select all cells in the responses sheet, copy, and paste here"
          />
        </label>
        <label className="file-input">
          …or upload the .csv file
          <input
            type="file"
            accept=".csv,text/csv,.tsv,.txt"
            onChange={async (e) => {
              setFileError("");
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2_000_000)
                return setFileError("That file is larger than 2 MB.");
              setPasted(await file.text());
            }}
          />
        </label>
        {fileError && (
          <div className="error" role="alert">
            {fileError}
          </div>
        )}
        <p className="muted">
          The answers are counted in your browser. They are sent to the AI only
          when you ask a live question in market research.
        </p>
        {results.responses > 0 && (
          <div data-testid="survey-results">
            <p>
              <strong>{results.responses} responses</strong> ·{" "}
              {results.questions.length} questions
            </p>
            {results.questions.map((q) => (
              <div key={q.question} className="survey-result">
                <h3>{q.question}</h3>
                {q.kind === "choice" ? (
                  <ul>
                    {q.answers.slice(0, 8).map((a) => {
                      const share = Math.round((a.count / q.answered) * 100);
                      return (
                        <li key={a.label}>
                          <span className="bar-label">
                            {a.label} — {a.count} ({share}%)
                          </span>
                          <span
                            className="bar"
                            style={{ width: `${share}%` }}
                            aria-hidden="true"
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="survey-quotes">
                    {q.examples.map((e) => (
                      <li key={e}>“{e}”</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                saveSurvey({
                  responses: results.responses,
                  text: summaryText(results.responses, results.questions),
                });
                navigate("/advisor");
              }}
            >
              Use these results in market research →
            </button>
          </div>
        )}
      </section>
    </>
  );
}
