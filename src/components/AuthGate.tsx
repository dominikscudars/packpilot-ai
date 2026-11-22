import { Icon } from "./Icon";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { configuredAuth, type AuthPort, type Identity } from "../auth/session";
import { createApi } from "../api/client";
import { createDemoGateway } from "../demo/apiDemo";
import type { Gateway } from "../models/api";
import { message } from "./AsyncState";
import {
  AccessTabs,
  Plans,
  SignUpForm,
  type AccessView,
} from "./AccountAccess";
export interface AppServices {
  auth: AuthPort | null;
  apiUrl: string;
  error: string | null;
  fetcher?: typeof fetch;
}
let defaultServices: AppServices | undefined;
export function AuthGate({
  services,
  children,
}: {
  services?: AppServices;
  children: (
    gateway: Gateway,
    mode: "demo" | "authenticated",
    exit: () => void,
    userId: string | null,
  ) => ReactNode;
}) {
  const [config] = useState<AppServices>(
    () => services ?? (defaultServices ??= configuredAuth()),
  );
  const acceptSession = useRef(true);
  const [session, setSession] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(!!config.auth);
  const [demo, setDemoState] = useState(readDemoChoice);
  // The demo choice lasts for this tab, so a refresh or a direct link
  // returns to the same workspace and onboarding state.
  const setDemo = (on: boolean) => {
    setDemoState(on);
    writeDemoChoice(on);
  };
  const [error, setError] = useState(config.error || "");
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<AccessView>("login");
  const [info, setInfo] = useState("");
  const [plans, setPlans] = useState<null | {
    greeting: string;
    after: "demo" | "session" | "back";
  }>(null);
  useEffect(() => {
    if (!config.auth) return;
    let active = true,
      version = 0;
    const unsubscribe = config.auth.subscribe((next) => {
      version++;
      if (active) {
        setSession(acceptSession.current ? next : null);
        setLoading(false);
      }
    });
    const initialVersion = version;
    void config.auth
      .current()
      .then((next) => {
        if (active && version === initialVersion)
          setSession(acceptSession.current ? next : null);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [config]);
  const userId = session?.userId;
  const activeGateway = useRef<Gateway | null>(null);
  const gateway = useMemo(() => {
    if (demo) {
      const candidate = createDemoGateway(
        {
          getItem: (key) => localStorage.getItem(key),
          setItem: (key, value) => localStorage.setItem(key, value),
        },
        (text) =>
          queueMicrotask(() => {
            if (activeGateway.current === candidate) setError(text);
          }),
      );
      return candidate;
    }
    if (userId && config.auth) {
      const candidate = createApi(
        config.apiUrl,
        config.auth,
        userId,
        () => {
          if (activeGateway.current !== candidate) return;
          acceptSession.current = false;
          setSession(null);
          setError("Your session expired. Sign in again.");
          setBusy(true);
          void config.auth
            ?.signOut()
            .catch(() => {
              setSignOutFailed(true);
            })
            .finally(() => setBusy(false));
        },
        config.fetcher,
      );
      return candidate;
    }
    return null;
  }, [demo, userId, config]);
  useLayoutEffect(() => {
    activeGateway.current = gateway;
    return () => {
      if (activeGateway.current === gateway) activeGateway.current = null;
    };
  }, [gateway]);
  async function signOut() {
    if (demo) {
      setDemo(false);
      setError("");
      return;
    }
    setBusy(true);
    acceptSession.current = false;
    setSession(null);
    setPassword("");
    try {
      await config.auth?.signOut();
      setSignOutFailed(false);
      setError("");
    } catch {
      setSignOutFailed(true);
      setError(
        "Local workspace cleared. Sign-out could not be confirmed; retry signing out before leaving a shared device.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="auth-screen">
        <p role="status">Restoring your session…</p>
      </main>
    );
  if (plans)
    return (
      <Plans
        greeting={plans.greeting}
        continueLabel={
          plans.after === "back" ? "Back to sign in" : "Continue to PackPilot"
        }
        onContinue={() => {
          if (plans.after === "demo") {
            setError("");
            setDemo(true);
          }
          setPlans(null);
        }}
      />
    );
  if (gateway)
    return (
      <div key={demo ? "demo" : userId}>
        {error && (
          <div className="notice" role="status">
            {error}
          </div>
        )}
        {children(
          gateway,
          demo ? "demo" : "authenticated",
          () => {
            void signOut();
          },
          demo ? null : (userId ?? null),
        )}
      </div>
    );
  return (
    <main className="auth-screen">
      <aside className="auth-story">
        <div className="brand">
          <img
            className="brand-logo brand-logo-large"
            src="/logo.svg"
            alt="PackPilot AI"
          />
        </div>
        <h2>
          Less guesswork.
          <br />
          <span>More clarity.</span>
        </h2>
        <p>Your packaging costs, forecasts and market research in one place.</p>
        <div className="auth-features">
          <span>
            <Icon name="wallet" /> Understand costs
          </span>
          <span>
            <Icon name="spark" /> Research options
          </span>
          <span>
            <Icon name="chart" /> Forecast growth
          </span>
        </div>
      </aside>
      <section className="panel auth-panel">
        <span className="eyebrow">PACKPILOT AI</span>
        <h1>Your packaging workspace</h1>
        <p>Sign in to your company workspace.</p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {signOutFailed && (
          <button
            className="secondary"
            onClick={() => {
              void signOut();
            }}
          >
            Retry sign out
          </button>
        )}
        <AccessTabs
          view={view}
          onChange={(next) => {
            setView(next);
            setError("");
            setInfo("");
          }}
        />
        {info && (
          <p className="notice" role="status">
            {info}
          </p>
        )}
        {view === "login" ? (
          <>
            {config.auth ? (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (busy) return;
                  setBusy(true);
                  setError("");
                  try {
                    acceptSession.current = true;
                    await config.auth?.signIn(email, password);
                    setPassword("");
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button disabled={busy} type="submit">
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <p className="footnote">
                  Use an account created in your organization’s Supabase
                  project. Ask your company owner for access.
                </p>
              </form>
            ) : (
              <p className="notice">
                Sign-in isn't enabled on this demo yet. Use{" "}
                <strong>Open local demo</strong> below.
              </p>
            )}
          </>
        ) : (
          <SignUpForm
            auth={config.auth}
            onDone={(outcome, profile) => {
              const greeting = `Welcome${profile.name ? `, ${profile.name}` : ""}`;
              if (outcome.kind === "confirm-email") {
                setView("login");
                setInfo(
                  `Check ${outcome.email} and confirm your address, then log in.`,
                );
                return;
              }
              if (outcome.kind === "session") acceptSession.current = true;
              setPlans({
                greeting,
                after: outcome.kind === "session" ? "session" : "demo",
              });
            }}
          />
        )}
        <hr />
        <h2>Explore the local demo</h2>

        <button
          className="secondary"
          onClick={() => {
            setError("");
            setDemo(true);
          }}
        >
          Open local demo
        </button>
      </section>
    </main>
  );
}

const DEMO_CHOICE = "packpilot.demo-open.v1";
function readDemoChoice(): boolean {
  try {
    return sessionStorage.getItem(DEMO_CHOICE) === "1";
  } catch {
    return false;
  }
}
function writeDemoChoice(on: boolean) {
  try {
    if (on) sessionStorage.setItem(DEMO_CHOICE, "1");
    else sessionStorage.removeItem(DEMO_CHOICE);
  } catch {
    // Storage blocked: the demo lasts until the page is reloaded.
  }
}
