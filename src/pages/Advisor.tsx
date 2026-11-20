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
  /** A hand-researched example shown without calling the AI service. */
  prepared?: boolean;
  /** The company data and survey this turn was based on. */
  context: string;
}

/** The four questions the assistant is built to answer. */
const STARTERS = [
  "How could we reduce our packaging costs?",
  "How could we make our packing more efficient?",
  "How could we produce more with our current machine and staff?",
  "Would different packaging, materials, suppliers or equipment improve our business?",
];

export const ADVISOR_URL = "/api/advisor";
/** Give up a little after the server's own limit (240 s). */
const CLIENT_TIMEOUT_MS = 270_000;
const NO_DATA = "no-company-data";

const NOT_CONFIGURED =
  "Live AI isn't configured in this demo environment yet — explore the verified OG TOFU research answers below.";

/** Plain-language explanation for each server error category. */
function explain(code: AdvisorErrorCode | undefined, fallback: string) {
  switch (code) {
    case "quota":
      return "The free AI quota is used up for now. Prepared answers below still work; try a live question again later.";
    case "rate_limited":
      return "Too many questions in a short time. Wait a few minutes; prepared answers still work.";
    case "not_configured":
      return NOT_CONFIGURED;
    case "unavailable":
      return "The AI service is busy or unavailable. Try again in a minute.";
    default:
      return fallback;
  }
}

/** The conversation is kept for this tab and workspace, so it survives edits. */
const STORE = (scope: string) => `packpilot.research.v1:${scope}`;
function loadTurns(scope: string): Turn[] {
  try {
    const raw = sessionStorage.getItem(STORE(scope));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (t): t is Turn =>
            !!t &&
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string" &&
            typeof t.context === "string",
        )
      : [];
  } catch {
    return [];
  }
}
function saveTurns(scope: string, turns: Turn[]) {
  try {
    sessionStorage.setItem(STORE(scope), JSON.stringify(turns.slice(-40)));
  } catch {
    // Storage blocked: the conversation lasts while the page is open.
  }
}

/** Market research assistant, grounded in the company's saved data. */
export function Advisor({ fetcher = fetch }: { fetcher?: typeof fetch }) {
  const { baseline, gateway, scope, onboarding } = useWorkspace();
  const hasData = onboarding === "completed";
  const [survey, setSurvey] = useState(() => loadSurvey(scope));
  const snapshot = hasData ? snapshotId(baseline.input) : null;
  // A turn belongs to one snapshot of the saved data and one survey; turns
  // from earlier data stay visible but are marked and not sent again.
  const context = `${snapshot ?? NO_DATA}:${survey?.text ?? ""}`;
  const [turns, setTurnsState] = useState<Turn[]>(() => loadTurns(scope));
  const setTurns = (next: Turn[]) => {
    setTurnsState(next);
    saveTurns(scope, next);
  };
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState("");
  // Opened once live AI turns out to be unconfigured; never closed for the user.
  const [examplesOpen, setExamplesOpen] = useState(false);
  const setError = (message: string) => {
    setErrorState(message);
    if (message === NOT_CONFIGURED) setExamplesOpen(true);
  };
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const older = turns.some((t) => !t.prepared && t.context !== context);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: text, context }];
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
          ...(hasData ? { scenario: baseline.input } : {}),
          ...(survey ? { context: survey.text } : {}),
          // Only turns based on the current data; prepared examples and
          // answers about older data are not part of the conversation.
          messages: next
            .filter((t) => !t.prepared && t.context === context)
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
          context,
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
      { role: "user", content: item.question, prepared: true, context },
      {
        role: "assistant",
        content: item.answer,
        sources: item.sources,
        prepared: true,
        context,
      },
    ]);
  }

  return (
    <div className="page research">
      <header className="page-head">
        <div>
          <span className="eyebrow">Ask market research</span>
          <h1>Market research</h1>
          <p>
            Ask how to cut costs, pack more efficiently or produce more. The
            assistant researches machines, materials, suppliers and EU rules on
            the web, cites its sources, and tests options with PackPilot's
            calculations on your data.
          </p>
        </div>
        {hasData && (
          <div className="head-actions">
            <Link to="/data" className="button secondary">
              Edit data &amp; costs
            </Link>
          </div>
        )}
      </header>

      {hasData ? (
        <ResearchBasis
          input={baseline.input}
          snapshot={snapshot!}
          survey={survey}
          onRemoveSurvey={() => {
            clearSurvey(scope);
            setSurvey(null);
          }}
          gateway={gateway}
        />
      ) : (
        <section
          className="card notice-card"
          role="note"
          data-testid="general-guidance"
        >
          <h2>General guidance only</h2>
          <p>
            You haven't entered your company data, so the assistant can only
            give general advice. Tailored recommendations, estimated savings and
            capacity figures need your production and cost data.
          </p>
          <Link to="/welcome" className="button">
            Enter your data
          </Link>
        </section>
      )}

      <section className="card chat" aria-label="Conversation">
        <div className="chat-log" aria-live="polite">
          {turns.length === 0 && (
            <div className="chat-empty">
              <h2>What would you like to improve?</h2>
              <p className="muted">Pick a question or write your own.</p>
              <div className="starters">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="starter"
                    disabled={busy}
                    onClick={() => void ask(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {older && (
            <p className="notice" data-testid="older-data-notice">
              Your data or attached survey changed since some answers below.
              Those answers are marked <strong>Based on older data</strong> and
              are no longer sent with new questions.
            </p>
          )}
          {turns.map((turn, i) => {
            const stale = !turn.prepared && turn.context !== context;
            return (
              <div
                key={i}
                className={`turn turn-${turn.role}${stale ? " turn-stale" : ""}`}
                data-testid={`advisor-${turn.role}`}
              >
                <div className="turn-meta">
                  <strong>
                    {turn.role === "user"
                      ? turn.prepared
                        ? "Example question"
                        : "You"
                      : "Market research"}
                  </strong>
                  {stale && (
                    <span className="badge badge-warn" data-testid="older-data">
                      Based on older data
                    </span>
                  )}
                  {turn.prepared && turn.role === "assistant" && (
                    <span className="badge">
                      Prepared example for OG TOFU · researched {PREPARED_DATE}
                    </span>
                  )}
                </div>
                {turn.role === "assistant" ? (
                  <ReportText text={turn.content} />
                ) : (
                  <div className="advisor-text">{turn.content}</div>
                )}
                {turn.basis && (
                  <p className="answer-basis" data-testid="answer-basis">
                    {turn.basis.snapshotId
                      ? `Based on your saved data (snapshot ${turn.basis.snapshotId}${
                          turn.basis.surveyAttached
                            ? ", with customer survey"
                            : ""
                        })`
                      : "General guidance without company data"}{" "}
                    · {turn.basis.engineCalls} PackPilot calculation
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
                    <span className="muted">Sources:</span>
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
            );
          })}
          {busy && (
            <div className="advisor-busy" role="status">
              <span className="spinner" aria-hidden="true" />
              <span className="muted">
                Researching and testing options with PackPilot's calculations. A
                full answer can take one to three minutes…
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
          {error &&
            (error === NOT_CONFIGURED ? (
              // A setup gap, not an outage: calm note instead of an error.
              <p className="notice" role="status">
                {error}
              </p>
            ) : (
              <div className="error" role="alert">
                {error}
              </div>
            ))}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <label htmlFor="advisor-question" className="sr-only">
            Your question
          </label>
          <textarea
            id="advisor-question"
            rows={2}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(draft);
              }
            }}
            placeholder="Ask about costs, efficiency, capacity, materials or suppliers…"
          />
          <button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Working…" : "Ask the advisor"}
          </button>
        </form>
      </section>


      <details className="card prepared" open={examplesOpen}>
        <summary>
          Example research for a sample company (OG TOFU) · no AI quota used
        </summary>

      <details className="card prepared">
        <summary>Example research for a sample company (OG TOFU)</summary>

        <p className="muted">
          Answers researched on {PREPARED_DATE} for OG TOFU, a Latvian tofu
          producer.
        </p>
        <div className="starters">
          {PREPARED_ANSWERS.map((item) => (
            <button
              key={item.question}
              type="button"
              className="starter"
              disabled={busy}
              onClick={() => showPrepared(item)}
            >
              {item.question}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function ResearchBasis({
  input,
  snapshot,
  survey,
  onRemoveSurvey,
  gateway,
}: {
  input: Parameters<ReturnType<typeof useWorkspace>["gateway"]["calculate"]>[0];
  snapshot: string;
  survey: { responses: number } | null;
  onRemoveSurvey: () => void;
  gateway: ReturnType<typeof useWorkspace>["gateway"];
}) {
  const costs = useRequest(JSON.stringify(input), () =>
    gateway.calculate(input),
  );
  return (
    <section className="card research-basis" aria-label="Research basis">
      <div className="basis-row">
        <div>
          <span className="kpi-label">Using your saved data</span>
          {costs.data ? (
            <p data-testid="research-costs">
              Packaging costs you{" "}
              <strong>
                {money(costs.data.totalPackagingOperatingEuro)} a month
              </strong>{" "}
              ({money(costs.data.packagingEuroPerPlannedKg, 3)} per kg). Every
              option is compared with these figures.
            </p>
          ) : (
            <p className="muted">Calculating your costs…</p>
          )}
        </div>
        <span className="badge" title="Identifies the exact data sent">
          Snapshot {snapshot}
        </span>
      </div>
      {survey ? (
        <p className="survey-attached" data-testid="survey-attached">
          Customer survey attached ({survey.responses} responses): the assistant
          uses it in live questions.{" "}
          <button
            type="button"
            className="link-button"
            onClick={onRemoveSurvey}
          >
            Remove
          </button>
        </p>
      ) : (
        <p className="muted small">
          Tip: run a <Link to="/survey">customer survey</Link> and attach the
          results for answers that reflect what your customers want.
        </p>
      )}
    </section>
  );
}
