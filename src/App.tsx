import { Icon } from "./components/Icon";
import { useEffect } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import {
  WorkspaceProvider,
  useWorkspace,
} from "./components/WorkspaceProvider";
import { AuthGate, type AppServices } from "./components/AuthGate";
import { Dashboard } from "./pages/Dashboard";
import { CompanyProfile } from "./pages/CompanyProfile";
import { DataEntry } from "./pages/DataEntry";
import { Advisor } from "./pages/Advisor";
import { Reorder } from "./pages/Reorder";
import { Survey } from "./pages/Survey";
import { Forecast } from "./pages/Forecast";
import { resetDemoStorage } from "./setup/resetDemo";
function Shell({ exit }: { exit: () => void }) {
  const { company, mode, setupReady, reviewed } = useWorkspace();
  // Onboarding gate (UI only): until saved inputs meet the engine's minimum
  // requirements, and until a returning demo visitor has reviewed them, every
  // address shows the setup screen. Backend auth and membership still apply.
  const gated = !setupReady || (mode === "demo" && !reviewed);
  const { pathname } = useLocation();
  // Each page starts at the top, not at the previous page's scroll position.
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="box" />
          </span>
          <span>
            PackPilot<span className="brand-ai"> AI</span>
            <small>PACKAGING INTELLIGENCE</small>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <div className="company-badge">
          <span>{company.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{company.name || "Company"}</strong>
            <small>Pilot workspace</small>
          </div>
        </div>
        {gated ? (
          <div className="setup-guide" role="note">
            <div className="nav-label">GETTING STARTED</div>
            <p>
              <strong>1. Enter your data</strong>, then see your{" "}
              <strong>2. Packaging Insights</strong>. The other features open
              once your data is saved.
            </p>
            {mode === "demo" && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  resetDemoStorage();
                  exit();
                }}
              >
                Reset demo
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="nav-label">YOUR WORKSPACE</div>
            <nav aria-label="Main navigation">
              <NavLink to="/" end>
                <Icon name="overview" />
                Packaging Insights
              </NavLink>
              <NavLink to="/data">
                <Icon name="form" />
                Edit data &amp; costs
              </NavLink>
            </nav>
            <div className="nav-label">FEATURES</div>
            <nav aria-label="Features">
              {(
                [
                  { path: "/advisor", name: "Market research", icon: "spark" },
                  { path: "/forecast", name: "Sales forecast", icon: "chart" },
                  { path: "/reorder", name: "Stock & orders", icon: "box" },
                  { path: "/survey", name: "Customer survey", icon: "survey" },
                  {
                    path: "/company",
                    name: "Company profile",
                    icon: "company",
                  },
                ] as const
              ).map((item) => (
                <NavLink key={item.path} to={item.path}>
                  <Icon name={item.icon} />
                  {item.name}
                </NavLink>
              ))}
            </nav>
            {mode === "demo" && (
              <button
                type="button"
                className="secondary sidebar-reset"
                onClick={() => {
                  resetDemoStorage();
                  exit();
                }}
              >
                Reset demo
              </button>
            )}
          </>
        )}
        <div className="sidebar-footer">
          <div className="sidebar-note">
            <Icon name="shield" />
            <strong>Clarity in every decision.</strong>
            <p>
              Built on your inputs.
              <br />
              Grounded in transparent calculations.
            </p>
          </div>
          <span className="live-dot" /> Pilot release
        </div>
      </aside>
      <div className="main-column">
        <div className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>{company.name || "Company"}</strong>
          </span>
          <span className="storage-status">
            <span className="live-dot" />
            {mode === "demo" ? "Local demo" : "Connected company workspace"}
          </span>
        </div>
        <main id="main" tabIndex={-1}>
          {gated ? (
            <Routes>
              <Route path="/data" element={<DataEntry />} />
              <Route path="*" element={<Navigate to="/data" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/data" element={<DataEntry />} />
              <Route path="/advisor" element={<Advisor />} />
              <Route path="/company" element={<CompanyProfile />} />
              <Route path="/simulator" element={<Navigate to="/" replace />} />
              <Route path="/reorder" element={<Reorder />} />
              <Route path="/survey" element={<Survey />} />
              <Route path="/forecast" element={<Forecast />} />
              <Route
                path="/inventory"
                element={<Navigate to="/reorder" replace />}
              />
              <Route
                path="*"
                element={
                  <section className="panel">
                    <h1>Page not found</h1>
                    <Link to="/">Return to Packaging Insights</Link>
                  </section>
                }
              />
            </Routes>
          )}
          <footer className="page-footer">
            <span>PackPilot AI · Pilot release</span>
            <span>Deterministic calculations. Transparent assumptions.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function App({ services }: { services?: AppServices }) {
  return (
    <AuthGate services={services}>
      {(gateway, mode, exit, userId) => (
        <WorkspaceProvider
          gateway={gateway}
          mode={mode}
          exit={exit}
          userId={userId}
        >
          <Shell exit={exit} />
        </WorkspaceProvider>
      )}
    </AuthGate>
  );
}
