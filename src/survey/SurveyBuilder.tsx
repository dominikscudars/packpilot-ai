import { useMemo, useState } from "react";
import { useWorkspace } from "../components/WorkspaceProvider";
import { surveyText } from "./questions";
import {
  AUDIENCES,
  GOALS,
  personalSurvey,
  size,
  surveyContext,
  type Audience,
  type Goal,
  type Length,
} from "./personal";

/** OG TOFU's test prices from its own consumer survey (demo only). */
const OG_TEST_PRICES: Record<number, number> = {
  1000: 4,
  500: 2.25,
  250: 1.25,
};

type Step = "product" | "goals" | "audience" | "prices" | "length" | "done";

/**
 * A few quick questions, then a survey written for this company. It looks
 * like a conversation but runs on PackPilot's own rules and numbers.
 */
export function SurveyBuilder() {
  const { baseline, catalog, company, mode } = useWorkspace();
  const [step, setStep] = useState<Step>("product");
  const [product, setProduct] = useState(
    catalog.products.at(0)?.name ??
      (company.name === "OG TOFU" ? "fresh tofu" : ""),
  );
  const [goals, setGoals] = useState<Goal[]>([]);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [length, setLength] = useState<Length>("short");
  const [removed, setRemoved] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const numericPrices = Object.fromEntries(
    Object.entries(prices).map(([g, v]) => [
      Number(g),
      Number(v.replace(",", ".")) || undefined,
    ]),
  );
  const ctx = useMemo(
    () => surveyContext(baseline.input, company.name, product, numericPrices),
    [baseline.input, company.name, product, JSON.stringify(numericPrices)],
  );
  const asksPrices =
    audience === "consumers" &&
    (goals.includes("price") || goals.includes("packs")) &&
    ctx.sizes.length > 0;
  const questions =
    step === "done" && audience
      ? personalSurvey(ctx, goals, audience, length).filter(
          (q) => !removed.includes(q.id),
        )
      : [];

  const reset = () => {
    setStep("product");
    setGoals([]);
    setAudience(null);
    setRemoved([]);
    setCopied(false);
  };

  const Bot = ({ children }: { children: React.ReactNode }) => (
    <div className="chat-bubble bot">{children}</div>
  );
  const Me = ({ children }: { children: React.ReactNode }) => (
    <div className="chat-bubble me">{children}</div>
  );
  const reached = (s: Step) => {
    const order: Step[] = [
      "product",
      "goals",
      "audience",
      "prices",
      "length",
      "done",
    ];
    return order.indexOf(step) > order.indexOf(s);
  };

  return (
    <section className="card survey-builder" aria-label="Survey builder">
      <div className="chat-thread" aria-live="polite">
        <Bot>
          I'll write a survey for <strong>{company.name}</strong> from your
          numbers. What product is it about?
        </Bot>
        {step === "product" ? (
          <form
            className="chat-reply"
            onSubmit={(e) => {
              e.preventDefault();
              if (product.trim()) setStep("goals");
            }}
          >
            <label className="sr-only" htmlFor="survey-product">
              Product
            </label>
            <input
              id="survey-product"
              value={product}
              placeholder="e.g. fresh tofu"
              onChange={(e) => setProduct(e.target.value)}
            />
            <button type="submit" disabled={!product.trim()}>
              Continue
            </button>
          </form>
        ) : (
          <Me>{product}</Me>
        )}

        {reached("product") && (
          <>
            <Bot>What do you want to find out? Pick one or more.</Bot>
            {step === "goals" ? (
              <div className="chat-reply">
                <div
                  className="chips"
                  role="group"
                  aria-label="What to find out"
                >
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="chip"
                      aria-pressed={goals.includes(g.id)}
                      onClick={() =>
                        setGoals(
                          goals.includes(g.id)
                            ? goals.filter((x) => x !== g.id)
                            : [...goals, g.id],
                        )
                      }
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={goals.length === 0}
                  onClick={() => setStep("audience")}
                >
                  Continue
                </button>
              </div>
            ) : (
              <Me>
                {GOALS.filter((g) => goals.includes(g.id))
                  .map((g) => g.label)
                  .join(", ")}
              </Me>
            )}
          </>
        )}

        {reached("goals") && (
          <>
            <Bot>Who will answer it?</Bot>
            {step === "audience" ? (
              <div className="chat-reply">
                <div
                  className="chips"
                  role="group"
                  aria-label="Who will answer"
                >
                  {AUDIENCES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="chip"
                      onClick={() => {
                        setAudience(a.id);
                        setStep(
                          a.id === "consumers" &&
                            (goals.includes("price") ||
                              goals.includes("packs")) &&
                            ctx.sizes.length > 0
                            ? "prices"
                            : "length",
                        );
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Me>{AUDIENCES.find((a) => a.id === audience)?.label}</Me>
            )}
          </>
        )}

        {reached("audience") && asksPrices && (
          <>
            <Bot>
              What are your shelf prices? I'll test them against each other.
            </Bot>
            {step === "prices" ? (
              <div className="chat-reply">
                <div className="price-row">
                  {ctx.sizes.map((g) => (
                    <label key={g}>
                      {`${size(g)} (€)`}
                      <input
                        inputMode="decimal"
                        value={prices[g] ?? ""}
                        placeholder={
                          mode === "demo" && OG_TEST_PRICES[g]
                            ? OG_TEST_PRICES[g].toFixed(2)
                            : "e.g. 2.25"
                        }
                        onChange={(e) =>
                          setPrices({ ...prices, [g]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="chat-actions">
                  {mode === "demo" && company.name === "OG TOFU" && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setPrices(
                          Object.fromEntries(
                            ctx.sizes
                              .filter((g) => OG_TEST_PRICES[g])
                              .map((g) => [g, String(OG_TEST_PRICES[g])]),
                          ),
                        )
                      }
                    >
                      Use OG TOFU's prices
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setPrices({});
                      setStep("length");
                    }}
                  >
                    Skip
                  </button>
                  <button type="button" onClick={() => setStep("length")}>
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <Me>
                {Object.values(prices).some((v) => v)
                  ? ctx.sizes
                      .filter((g) => prices[g])
                      .map((g) => `${size(g)} €${prices[g]}`)
                      .join(" · ")
                  : "No prices"}
              </Me>
            )}
          </>
        )}

        {(reached("prices") || (reached("audience") && !asksPrices)) && (
          <>
            <Bot>Short and quick, or the full version?</Bot>
            {step === "length" ? (
              <div className="chat-reply">
                <div className="chips" role="group" aria-label="Survey length">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setLength("short");
                      setStep("done");
                    }}
                  >
                    Short (about 2 minutes)
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setLength("full");
                      setStep("done");
                    }}
                  >
                    Full (about 5 minutes)
                  </button>
                </div>
              </div>
            ) : (
              <Me>{length === "short" ? "Short" : "Full"}</Me>
            )}
          </>
        )}

        {step === "done" && (
          <>
            <Bot>
              Here is your survey: {questions.length} questions, each tied to
              your numbers.
            </Bot>
            <ol className="personal-survey" data-testid="survey-questions">
              {questions.map((q) => (
                <li key={q.id}>
                  <div className="ps-head">
                    <strong>{q.title}</strong>
                    <button
                      type="button"
                      className="ghost ps-remove"
                      aria-label={`Remove: ${q.title}`}
                      onClick={() => setRemoved([...removed, q.id])}
                    >
                      ×
                    </button>
                  </div>
                  {q.options.length > 0 && (
                    <span className="ps-options">{q.options.join(" · ")}</span>
                  )}
                  <span className="ps-why">Why: {q.why}</span>
                </li>
              ))}
            </ol>
            <div className="chat-actions">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(surveyText(questions))
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
              <button type="button" className="ghost" onClick={reset}>
                Start again
              </button>
            </div>
            <details className="survey-howto">
              <summary>How to make the Google Form</summary>
              <ol>
                <li>Click “Open a new Google Form”.</li>
                <li>
                  Add each question and paste its options; each line becomes one
                  option.
                </li>
                <li>Click “Send” and share the link.</li>
                <li>
                  When answers are in, open “Responses” → “Link to Sheets”, copy
                  the sheet and paste it below.
                </li>
              </ol>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
