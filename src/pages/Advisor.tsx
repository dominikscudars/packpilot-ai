import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import type { AdvisorReply } from "../advisor/server";
import { ReportText } from "../components/ReportText";
import { DataSummary } from "../components/DataSummary";
import { useRequest } from "../components/AsyncState";
import { money } from "../components/ApiResults";
import { DEMO_REFERENCE_NAME } from "../demo/apiDemo";
import { clearSurvey, loadSurvey } from "../survey/surveyStore";
import {
  PREPARED_ANSWERS,
  PREPARED_DATE,
  type PreparedAnswer,
} from "../advisor/preparedAnswers";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: AdvisorReply["sources"];
  /** A hand-researched answer shown without calling the AI service. */
  prepared?: boolean;
}

const STARTERS = [
  "How can we make 250 g and 500 g packs cheaper per kilogram?",
  "What happens to our costs if shops want 30% of our production in 250 g packs?",
];

export const ADVISOR_URL = "/api/advisor";

/** Chat with the AI advisor; every figure comes from the PackPilot engine. */
export function Advisor({ fetcher = fetch }: { fetcher?: typeof fetch }) {
  const { baseline, gateway, mode } = useWorkspace();
  const [survey, setSurvey] = useState(loadSurvey);
  const costs = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const response = await fetcher(ADVISOR_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenario: baseline.input,
          ...(survey ? { context: survey.text } : {}),
          // Prepared answers are reference material, not part of the chat.
          messages: next
            .filter((t) => !t.prepared)
            .slice(-12)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        (AdvisorReply & { error?: string }) | null;
      if (!response.ok || !body || typeof body.reply !== "string")
        throw new Error(
          body?.error ??
            `The advisor is unavailable (HTTP ${response.status}).`,
        );
      setTurns([
        ...next,
        { role: "assistant", content: body.reply, sources: body.sources },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTurns(turns);
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "demo" && baseline.name === DEMO_REFERENCE_NAME)
    return <Navigate to="/data" replace />;

  function showPrepared(item: PreparedAnswer) {
    setError("");
    setTurns([
      ...turns,
      { role: "user", content: item.question, prepared: true },
      {
        role: "assistant",
        content: item.answer,
        sources: item.sources,
        prepared: true,
      },
    ]);
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STEP 3 OF 3</span>
          <h1>Market research</h1>
          <p>
            Ask about machinery, packaging materials, suppliers or EU and
            Latvian packaging rules. The advisor researches the web, cites its
            sources and tests every option with PackPilot's calculations on your
            operation ({baseline.name}). Change those numbers in{" "}
            <Link to="/data">step 1</Link>.
          </p>
        </div>
      </header>

      <DataSummary input={baseline.input} />

      <section className="panel research-basis" aria-label="Research basis">
        <h2>The research starts from your costs</h2>
        {costs.data ? (
          <p data-testid="research-costs">
            Packaging costs you{" "}
            <strong>
              {money(costs.data.totalPackagingOperatingEuro)} a month
            </strong>{" "}
            ({money(costs.data.packagingEuroPerPlannedKg, 3)} per kg):{" "}
            {costs.data.rows
              .map((row) => {
                const grams = baseline.input.formats.find(
                  (f) => f.id === row.formatId,
                )?.portionWeightGrams.value;
                return `${grams ?? "?"} g ${money(row.packagingEuroPerPackedKg, 3)}/kg`;
              })
              .join(" · ")}
            . Every option is compared with these figures.
          </p>
        ) : (
          <p className="muted">Calculating your costs…</p>
        )}
        {survey ? (
          <p className="survey-attached" data-testid="survey-attached">
            Customer survey attached ({survey.responses} responses): the
            assistant uses it in live questions.{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                clearSurvey();
                setSurvey(null);
              }}
            >
              Remove
            </button>
          </p>
        ) : (
          <p className="muted">
            Tip: run a customer survey with the Customer survey tool and attach
            the results here.
          </p>
        )}
      </section>

      <section className="panel prepared-panel">
        <h2>Prepared research for OG TOFU</h2>
        <p className="muted">
          Answers to OG TOFU's own questions, researched on {PREPARED_DATE}.
          Costs are PackPilot calculations on OG TOFU's data; prices and rules
          come from the sources listed under each answer. These open instantly
          and use no AI quota.
        </p>
        <div className="advisor-starters">
          {PREPARED_ANSWERS.map((item) => (
            <button
              key={item.question}
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => showPrepared(item)}
            >
              {item.question}
            </button>
          ))}
        </div>
      </section>

      <section className="panel advisor-panel" aria-live="polite">
        <h2>Ask your own question</h2>
        {turns.length === 0 && (
          <div className="advisor-starters">
            <p className="muted">
              Live research uses the free AI quota (a few questions a day). Try
              one of these:
            </p>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`advisor-turn advisor-${turn.role}`}
            data-testid={`advisor-${turn.role}`}
          >
            <strong>
              {turn.role === "user"
                ? turn.prepared
                  ? "OG TOFU asked"
                  : "You"
                : "Advisor"}
            </strong>
            {turn.prepared && turn.role === "assistant" && (
              <span className="prepared-badge">
                Prepared answer · researched {PREPARED_DATE}
              </span>
            )}
            {turn.role === "assistant" ? (
              <ReportText text={turn.content} />
            ) : (
              <div className="advisor-text">{turn.content}</div>
            )}
            {turn.sources && turn.sources.length > 0 && (
              <div className="advisor-sources">
                <span className="muted">Sources (external, unverified):</span>
                <ul>
                  {turn.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <p className="muted" role="status">
            Researching and testing options with PackPilot's calculations. A
            full research answer can take one to three minutes…
          </p>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <form
          className="advisor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <label htmlFor="advisor-question">Your question</label>
          <textarea
            id="advisor-question"
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. What happens to our costs if shops want 30% of production in 250 g packs?"
          />
          <button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Working…" : "Ask the advisor"}
          </button>
        </form>
        <p className="footnote">
          AI suggestions can be wrong. Figures come from PackPilot's
          deterministic calculations on the inputs shown; prices found online
          are unverified. The advisor does not certify food safety, shelf life,
          recyclability or machine compatibility.
        </p>
      </section>
    </>
  );
}
