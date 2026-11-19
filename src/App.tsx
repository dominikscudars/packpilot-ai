import { Icon } from "./components/Icon";
import { NavLink, Navigate, Route, Routes, Link } from "react-router-dom";
import {
  WorkspaceProvider,
  useWorkspace,
} from "./components/WorkspaceProvider";
import { AuthGate, type AppServices } from "./components/AuthGate";
import { Dashboard } from "./pages/Dashboard";
import { CompanyProfile } from "./pages/CompanyProfile";
import { DataEntry } from "./pages/DataEntry";
import { Advisor } from "./pages/Advisor";
function Shell() {
  const { company, mode } = useWorkspace();
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
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { path: "/data", name: "1. Enter your data", icon: "form" },
              { path: "/", name: "2. Your costs", icon: "overview" },
              {
                path: "/advisor",
                name: "3. Research & advice",
                icon: "spark",
              },
              { path: "/company", name: "Company profile", icon: "company" },
            ] as const
          ).map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === "/"}>
              <Icon name={item.icon} />
              {item.name}
            </NavLink>
          ))}
        </nav>
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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/data" element={<DataEntry />} />
            <Route path="/advisor" element={<Advisor />} />
            <Route path="/company" element={<CompanyProfile />} />
            <Route path="/simulator" element={<Navigate to="/" replace />} />
            <Route path="/inventory" element={<Navigate to="/" replace />} />
            <Route
              path="*"
              element={
                <section className="panel">
                  <h1>Page not found</h1>
                  <Link to="/">Return to overview</Link>
                </section>
              }
            />
          </Routes>
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
      {(gateway, mode, exit) => (
        <WorkspaceProvider gateway={gateway} mode={mode} exit={exit}>
          <Shell />
        </WorkspaceProvider>
      )}
    </AuthGate>
  );
}
