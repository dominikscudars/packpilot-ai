import { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import type { AdvisorReply } from "../advisor/server";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: AdvisorReply["sources"];
}

const STARTERS = [
  "We want to grow from 1 to 10 tonnes a month. What should we upgrade, and when?",
  "Is a faster packing machine worth it for us? Compare a few options.",
  "How can we make 250 g and 500 g packs cheaper per kilogram?",
];

export const ADVISOR_URL = "/api/advisor";

/** Chat with the AI advisor; every figure comes from the PackPilot engine. */
export function Advisor({ fetcher = fetch }: { fetcher?: typeof fetch }) {
  const { baseline } = useWorkspace();
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
          messages: next
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

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">AI RESEARCH ASSISTANT</span>
          <h1>Upgrade advisor</h1>
          <p>
            Ask how to upgrade your packaging. The advisor tests each idea with
            PackPilot's calculations on your current operation ({baseline.name})
            and can research machines and materials online. Change the numbers
            it starts from in <Link to="/data">Enter your data</Link>.
          </p>
        </div>
      </header>

      <section className="panel advisor-panel" aria-live="polite">
        {turns.length === 0 && (
          <div className="advisor-starters">
            <p className="muted">Try one of these questions:</p>
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
            <strong>{turn.role === "user" ? "You" : "Advisor"}</strong>
            <div className="advisor-text">{turn.content}</div>
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
            The advisor is testing options with PackPilot's calculations. This
            usually takes 20–60 seconds…
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
