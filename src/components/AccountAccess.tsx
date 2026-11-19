import { useEffect, useRef, useState } from "react";
import type { AuthPort, SignUpProfile } from "../auth/session";
import { message } from "./AsyncState";
import "./account.css";

export type AccessView = "login" | "signup";

export function AccessTabs({
  view,
  onChange,
}: {
  view: AccessView;
  onChange: (view: AccessView) => void;
}) {
  return (
    <div className="access-tabs" role="group" aria-label="Account access">
      <button
        type="button"
        aria-pressed={view === "login"}
        className={view === "login" ? "active" : ""}
        onClick={() => onChange("login")}
      >
        Log in
      </button>
      <button
        type="button"
        aria-pressed={view === "signup"}
        className={view === "signup" ? "active" : ""}
        onClick={() => onChange("signup")}
      >
        Sign up
      </button>
    </div>
  );
}

export type SignUpOutcome =
  | { kind: "session" }
  | { kind: "confirm-email"; email: string }
  | { kind: "preview" };

/**
 * Sign-up form. With Supabase configured it creates a real account; without
 * it, it runs as a labelled preview that creates nothing and stores nothing.
 */
export function SignUpForm({
  auth,
  onDone,
}: {
  auth: AuthPort | null;
  onDone: (outcome: SignUpOutcome, profile: SignUpProfile) => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = !auth?.signUp;
  return (
    <form
      className="signup-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setError("");
        if (password.length < 8)
          return setError("Use a password of at least 8 characters.");
        if (password !== confirm)
          return setError("The two passwords do not match.");
        const profile = { name: name.trim(), company: company.trim() };
        if (preview || !auth?.signUp) {
          setPassword("");
          setConfirm("");
          return onDone({ kind: "preview" }, profile);
        }
        setBusy(true);
        try {
          const result = await auth.signUp(email.trim(), password, profile);
          setPassword("");
          setConfirm("");
          onDone(
            result.needsConfirmation
              ? { kind: "confirm-email", email: email.trim() }
              : { kind: "session" },
            profile,
          );
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {preview && (
        <p className="notice">
          Preview: accounts are not enabled on this demo site, so no account is
          created and nothing you type is stored or sent.
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <label>
        Your name
        <input
          autoComplete="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Company name
        <input
          autoComplete="organization"
          required
          maxLength={100}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </label>
      <label>
        Work email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Create password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        Repeat password
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

interface Plan {
  id: string;
  name: string;
  price: string;
  summary: string;
  features: string[];
  free: boolean;
}

const PLANS: Plan[] = [
  {
    id: "pilot",
    name: "Pilot",
    price: "Free during the pilot",
    summary: "Everything in today's PackPilot, for pilot manufacturers.",
    features: [
      "Packaging cost calculator",
      "Scenario simulator",
      "Inventory planning",
      "AI upgrade advisor",
    ],
    free: true,
  },
  {
    id: "professional",
    name: "Professional",
    price: "Price to be decided after the pilot",
    summary: "Ongoing monitoring for growing manufacturers.",
    features: [
      "Everything in Pilot",
      "Several products and sites (planned)",
      "Cost history and alerts (planned)",
      "Priority support (planned)",
    ],
    free: false,
  },
  {
    id: "analysis",
    name: "One-off analysis",
    price: "Price to be decided after the pilot",
    summary: "A report for one decision, such as a new packing machine.",
    features: [
      "Review of your packaging data",
      "Options compared with PackPilot's calculations",
      "Written recommendation",
    ],
    free: false,
  },
];

/**
 * Plans and a simulated checkout. Nothing here takes payment, collects card
 * details, quotes a price or grants an entitlement.
 */
export function Plans({
  greeting,
  continueLabel,
  onContinue,
}: {
  greeting: string;
  continueLabel: string;
  onContinue: () => void;
}) {
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const checkoutRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // jsdom has no scrollIntoView; real browsers do.
    checkoutRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }, [checkout]);
  return (
    <main className="plans-screen">
      <header>
        <span className="eyebrow">CHOOSE A PLAN</span>
        <h1>{greeting}</h1>
        <p>
          Pricing will be set after the pilot. Start free today; paid plans
          below are a preview only.
        </p>
      </header>
      <div className="plans-grid">
        {PLANS.map((plan) => (
          <section
            key={plan.id}
            className={`panel plan-card${plan.free ? " plan-featured" : ""}`}
            aria-label={`${plan.name} plan`}
          >
            <h2>{plan.name}</h2>
            <p className="plan-price">{plan.price}</p>
            <p>{plan.summary}</p>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {plan.free ? (
              <button type="button" onClick={onContinue}>
                Start free pilot
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setCheckout(plan);
                  setConfirmed(false);
                }}
              >
                Preview checkout
              </button>
            )}
          </section>
        ))}
      </div>
      {checkout && (
        <section
          ref={checkoutRef}
          className="panel checkout-preview"
          role="dialog"
          aria-label="Simulated checkout"
        >
          <h2>Checkout preview: {checkout.name}</h2>
          <p className="notice">
            Simulated checkout. No payment is taken, no card details are
            collected and no subscription is created.
          </p>
          <p>{checkout.price}.</p>
          {confirmed ? (
            <>
              <p role="status">
                Simulation complete. Nothing was charged. You are on the free
                pilot.
              </p>
              <button type="button" onClick={onContinue}>
                {continueLabel}
              </button>
            </>
          ) : (
            <div className="checkout-actions">
              <button type="button" onClick={() => setConfirmed(true)}>
                Confirm (simulated)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setCheckout(null)}
              >
                Back to plans
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
