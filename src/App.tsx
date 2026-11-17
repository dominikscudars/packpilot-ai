import { NavLink, Route, Routes, Link } from "react-router-dom";
import {
  WorkspaceProvider,
  useWorkspace,
} from "./components/WorkspaceProvider";
import { Dashboard } from "./pages/Dashboard";
import { CompanyProfile } from "./pages/CompanyProfile";
import { Simulator } from "./pages/Simulator";
import { Inventory } from "./pages/Inventory";
function Shell() {
  const { workspace, notice } = useWorkspace();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span>
            PackPilot<span className="brand-ai"> AI</span>
            <small>PACKAGING INTELLIGENCE</small>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <div className="company-badge">
          <span>{workspace.company.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{workspace.company.name || "Company"}</strong>
            <small>Pilot workspace</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {[
            { path: "/", name: "Overview", icon: "▦" },
            { path: "/company", name: "Company profile", icon: "▣" },
            { path: "/simulator", name: "Scenario simulator", icon: "⇄" },
            { path: "/inventory", name: "Inventory planning", icon: "▤" },
          ].map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === "/"}>
              <span aria-hidden="true">{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="live-dot" /> Foundation release
          <p>
            Built for informed
            <br />
            manufacturing decisions.
          </p>
        </div>
      </aside>
      <div className="main-column">
        <div className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>{workspace.company.name || "Company"}</strong>
          </span>
          <span className="storage-status">
            <span className="live-dot" />
            {notice ? "Storage needs attention" : "Local browser workspace"}
          </span>
        </div>
        <main id="main" tabIndex={-1}>
          {notice && (
            <div className="error" role="status">
              {notice}
            </div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/company" element={<CompanyProfile />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/inventory" element={<Inventory />} />
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
            <span>PackPilot AI · Initial MVP</span>
            <span>Deterministic calculations. Transparent assumptions.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
