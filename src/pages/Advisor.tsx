import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import type { AdvisorReply } from "../advisor/server";
import {
  snapshotId,
  type AdvisorErrorCode,
  type AnswerBasis,
} from "../advisor/snapshot";
import { ReportText } from "../components/ReportText";
import { DataSummary } from "../components/DataSummary";
import { useRequest } from "../components/AsyncState";
import { money } from "../components/ApiResults";
import { clearSurvey, loadSurvey } from "../survey/surveyStore";
import {
  PREPARED_ANSWERS,
  PREPARED_DATE,
  type PreparedAnswer,
} from "../advisor/preparedAnswers";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: { url: string; title: string; retrievedAt?: string }[];
  basis?: AnswerBasis;
  /** A hand-researched answer shown without calling the AI service. */
  prepared?: boolean;
}

const STARTERS = [
  "How can we make 250 g and 500 g packs cheaper per kilogram?",
  "What happens to our costs if shops want 30% of our production in 250 g packs?",
];

export const ADVISOR_URL = "/api/advisor";
/** Give up a little after the server's own limit (240 s). */
const CLIENT_TIMEOUT_MS = 270_000;

/** Plain-language explanation for each server error category. */
function explain(code: AdvisorErrorCode | undefined, fallback: string) {
  switch (code) {
    case "quota":
      return "The free AI quota is used up for now. Prepared answers below still work; try a live question again later.";
    case "rate_limited":
      return "Too many questions in a short time. Wait a few minutes; prepared answers still work.";
    case "not_configured":
      return "Live research is not set up on this site yet. Prepared answers still work.";
    case "unavailable":
      return "The AI service is busy or unavailable. Try again in a minute.";
    default:
      return fallback;
  }
}

/** Chat with the AI advisor; every figure comes from the PackPilot engine. */
export function Advisor({ fetcher = fetch }: { fetcher?: typeof fetch }) {
  const { baseline, gateway, scope } = useWorkspace();
  const [survey, setSurvey] = useState(() => loadSurvey(scope));
  const snapshot = snapshotId(baseline.input);
  const costs = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  // A conversation belongs to one snapshot of the saved data and one survey.
  const context = `${snapshot}:${survey?.text ?? ""}`;
  const [conversation, setConversation] = useState<{
    context: string;
    turns: Turn[];
  }>({ context, turns: [] });
  const stale =
    conversation.context !== context && conversation.turns.length > 0;
  const turns = stale ? [] : conversation.turns;
  const setTurns = (next: Turn[]) => setConversation({ context, turns: next });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    setError("");
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort("timeout"), CLIENT_TIMEOUT_MS);
    try {
      const response = await fetcher(ADVISOR_URL, {
        method: "POST",
        signal: abort.signal,
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
        (AdvisorReply & { error?: string; code?: AdvisorErrorCode }) | null;
      if (!response.ok || !body || typeof body.reply !== "string")
        throw new Error(
          explain(
            body?.code,
            body?.error ??
              `The advisor is unavailable (HTTP ${response.status}).`,
          ),
        );
      setTurns([
        ...next,
        {
          role: "assistant",
          content: body.reply,
          sources: body.sources,
          basis: body.basis,
        },
      ]);
    } catch (e) {
      setError(
        abort.signal.aborted
          ? abort.signal.reason === "timeout"
            ? "No answer within four and a half minutes. Try a narrower question."
            : "Question cancelled. Nothing was saved."
          : e instanceof Error
            ? e.message
            : String(e),
      );
      setTurns(turns);
      setDraft(text);
    } finally {
      clearTimeout(timer);
      controller.current = null;
      setBusy(false);
    }
  }

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
          <span className="eyebrow">FEATURE</span>
          <h1>Market research</h1>
          <p>
            Ask about machinery, packaging materials, suppliers or EU and
            Latvian packaging rules. The advisor researches the web, cites its
            sources and tests every option with PackPilot's calculations on your
            operation ({baseline.name}). Change those numbers in{" "}
            <Link to="/data">Edit data &amp; costs</Link>.
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
                clearSurvey(scope);
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
              Live research uses a limited free AI quota shared by everyone
              using this demo. Try one of these:
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
        {stale && (
          <p className="notice" data-testid="conversation-reset">
            Your data or attached survey changed, so the earlier answers no
            longer match it and were cleared. Ask again to research with the
            current data.
          </p>
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
            {turn.basis && (
              <p className="answer-basis" data-testid="answer-basis">
                Based on your saved data (snapshot {turn.basis.snapshotId}
                {turn.basis.surveyAttached ? ", with customer survey" : ""}) ·{" "}
                {turn.basis.engineCalls} PackPilot calculation
                {turn.basis.engineCalls === 1 ? "" : "s"} ·{" "}
                {turn.basis.researchCalls} web search
                {turn.basis.researchCalls === 1 ? "" : "es"} · generated{" "}
                {new Date(turn.basis.generatedAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                by {turn.basis.model}.
              </p>
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
          <div className="advisor-busy" role="status">
            <span className="muted">
              Researching and testing options with PackPilot's calculations. A
              full research answer can take one to three minutes…
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => controller.current?.abort("cancel")}
            >
              Cancel
            </button>
          </div>
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
