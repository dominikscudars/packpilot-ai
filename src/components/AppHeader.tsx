import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useWorkspace } from "./WorkspaceProvider";
import { resetDemoStorage } from "../setup/resetDemo";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="PackPilot AI home">
      <img className="brand-logo" src="/logo.svg" alt="" />
    </Link>
  );
}

/** Company switcher, demo notice, Reset demo and exit / sign out. */
export function AccountControls({ compact = false }: { compact?: boolean }) {
  const { companies, selectCompany, company, mode, exit } = useWorkspace();
  return (
    <div className="account-controls">
      {mode === "demo" ? (
        <span className="mode-pill" title="Everything stays in this browser">
          <span className="live-dot" aria-hidden="true" /> Local demo
        </span>
      ) : null}
      <label className={`company-switch${compact ? " compact" : ""}`}>
        <span className="sr-only">Company</span>
        <select
          aria-label="Active company"
          value={company.id}
          disabled={companies.length < 2}
          onChange={(e) => selectCompany(e.target.value)}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {mode === "demo" && (
        <button
          type="button"
          className="ghost"
          onClick={() => {
            resetDemoStorage();
            exit();
          }}
        >
          Reset demo
        </button>
      )}
      <button type="button" className="ghost" onClick={exit}>
        {mode === "demo" ? "Exit demo" : "Sign out"}
      </button>
    </div>
  );
}

const TOOLS = [
  { path: "/forecast", name: "Sales history" },
  { path: "/reorder", name: "Stock & orders" },
  { path: "/survey", name: "Customer survey" },
  { path: "/brief", name: "Decision brief" },
  { path: "/company", name: "Company profile" },
] as const;

/** Workspace header: two primary destinations, research, and a tools menu. */
export function AppHeader() {
  const { pathname } = useLocation();
  const tools = useRef<HTMLDetailsElement>(null);
  // Close the tools menu after navigating.
  useEffect(() => {
    if (tools.current) tools.current.open = false;
  }, [pathname]);
  const toolActive = TOOLS.some((t) => pathname.startsWith(t.path));
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Brand />
        <nav aria-label="Main navigation" className="main-nav">
          <NavLink to="/" end>
            Workspace
          </NavLink>
          <NavLink to="/research">Market research</NavLink>
          <NavLink to="/data">Edit data &amp; costs</NavLink>
          <details className="tools-menu" ref={tools}>
            <summary className={toolActive ? "active" : undefined}>
              More tools
            </summary>
            <div className="tools-list">
              {TOOLS.map((t) => (
                <NavLink key={t.path} to={t.path}>
                  {t.name}
                </NavLink>
              ))}
            </div>
          </details>
        </nav>
        <AccountControls />
      </div>
    </header>
  );
}
