import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import {
  WorkspaceProvider,
  useWorkspace,
} from "./components/WorkspaceProvider";
import { AuthGate, type AppServices } from "./components/AuthGate";
import { AppHeader } from "./components/AppHeader";
import {
  Workspace,
  WorkspaceCosts,
  WorkspaceForecast,
  WorkspaceSavings,
  EmptyState,
} from "./pages/Workspace";
import { Onboarding } from "./pages/Onboarding";
import { EditData } from "./pages/EditData";
import { CompanyProfile } from "./pages/CompanyProfile";
import { Advisor } from "./pages/Advisor";
import { Survey } from "./pages/Survey";
import { Brief } from "./pages/Brief";

/** Tools that calculate from the company's data show an empty state until it exists. */
function NeedsData({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { onboarding } = useWorkspace();
  if (onboarding === "completed") return <>{children}</>;
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="card section">
        <EmptyState
          title="Enter your data first"
          text={`${title} works from your production and cost data, which you haven't entered yet.`}
        />
      </section>
    </div>
  );
}

function Shell() {
  const { onboarding } = useWorkspace();
  const { pathname } = useLocation();
  // Each page starts at the top, not at the previous page's scroll position.
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);

  // First visit: only the full-screen data entry, at every address.
  // UI gate only; backend authentication and membership checks still apply.
  if (onboarding === "none")
    return (
      <Routes>
        <Route path="/welcome" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    );
  if (pathname === "/welcome" && onboarding === "skipped")
    return <Onboarding />;

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AppHeader />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />
          <Route
            path="/data"
            element={
              onboarding === "completed" ? (
                <EditData />
              ) : (
                <Navigate to="/welcome" replace />
              )
            }
          />
          <Route path="/research" element={<Advisor />} />
          <Route
            path="/advisor"
            element={<Navigate to="/research" replace />}
          />
          <Route path="/company" element={<CompanyProfile />} />
          <Route path="/reorder" element={<Navigate to="/" replace />} />
          <Route
            path="/survey"
            element={
              <NeedsData title="Customer survey">
                <Survey />
              </NeedsData>
            }
          />
          <Route
            path="/brief"
            element={
              <NeedsData title="Decision brief">
                <Brief />
              </NeedsData>
            }
          />
          <Route path="/costs" element={<WorkspaceCosts />} />
          <Route path="/forecast" element={<WorkspaceForecast />} />
          <Route path="/savings" element={<WorkspaceSavings />} />
          <Route path="/simulator" element={<Navigate to="/" replace />} />
          <Route path="/inventory" element={<Navigate to="/" replace />} />
          <Route
            path="*"
            element={
              <div className="page">
                <section className="card section">
                  <h1>Page not found</h1>
                  <Link to="/">Return to your workspace</Link>
                </section>
              </div>
            }
          />
        </Routes>
      </main>
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
          <Shell />
        </WorkspaceProvider>
      )}
    </AuthGate>
  );
}
