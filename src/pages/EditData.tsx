import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ScenarioInput } from "../models/api";
import { useWorkspace } from "../components/WorkspaceProvider";
import { message } from "../components/AsyncState";
import { setupProblems } from "../setup/setupState";
import {
  LabourSection,
  MaterialsSection,
  ProductionSection,
} from "../onboarding/FormSections";
import { editable } from "../onboarding/scenarioForm";

/**
 * Edit data & costs: the saved inputs on one page. Saving recalculates
 * Your costs and Future forecasting; nothing restarts onboarding.
 */
export function EditData() {
  const { baseline, setBaseline, saveScenario, draft, setDraft } =
    useWorkspace();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const saved = editable(baseline.input);
  const input = draft ? editable(draft) : saved;
  const dirty =
    draft !== null && JSON.stringify(input) !== JSON.stringify(saved);
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  // A save that finishes after leaving this page must not clear a newer
  // draft or navigate away from wherever the user is now.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Links such as "/data#costs" jump straight to a section.
  useEffect(() => {
    if (hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView?.({ block: "start" });
  }, [hash]);

  const problems = setupProblems(input);
  const errorFor = (field: string) =>
    showErrors
      ? problems
          .filter((p) => p.field === field)
          .map((p) => p.message)
          .join(" ") || undefined
      : undefined;
  const change = (next: ScenarioInput) => {
    setDraft(next);
    setSaveError("");
  };

  async function submit() {
    if (problems.length > 0) {
      setShowErrors(true);
      document.getElementById(problems[0].field)?.focus();
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const result = await saveScenario(
        { id: baseline.id, name: baseline.name || "My operation", input },
        baseline.id === null,
      );
      setBaseline(result);
      if (!mounted.current) return;
      setDraft(null);
      navigate("/");
    } catch (e) {
      if (mounted.current) setSaveError(message(e));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const props = { input, change, errorFor };
  return (
    <div className="page edit-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Your saved inputs</span>
          <h1>Edit data &amp; costs</h1>
          <p>
            Change any value and save: your costs and forecasts update at once.
            Leave a field empty if you don't know it; results that need it show
            as Unknown, never as zero.
          </p>
        </div>
        <nav className="section-jump" aria-label="Sections">
          <a href="#production">Production</a>
          <a href="#costs">Materials</a>
          <a href="#labour">Labour</a>
          <a href="#equipment">Capacity</a>
          <a href="#other-costs">Other costs</a>
        </nav>
      </header>

      <fieldset className="plain-fieldset" disabled={saving}>
        <section className="card form-card" aria-labelledby="h-production">
          <h2 id="h-production">Production</h2>
          <ProductionSection {...props} />
        </section>
        <section className="card form-card" aria-labelledby="h-materials">
          <h2 id="h-materials">Packaging materials</h2>
          <MaterialsSection {...props} />
        </section>
        <section className="card form-card" aria-labelledby="h-labour">
          <h2 id="h-labour">Labour, capacity &amp; other costs</h2>
          <LabourSection {...props} />
        </section>
      </fieldset>

      <div className="save-bar" role="region" aria-label="Save changes">
        <div className="save-bar-inner">
          <div className="save-bar-text">
            {showErrors && problems.length > 0 ? (
              <div className="error" role="alert">
                <p>
                  Please check{" "}
                  {problems.length === 1 ? "this field" : "these fields"}:
                </p>
                <ul>
                  {problems.map((p) => (
                    <li key={p.field + p.message}>
                      <a
                        href={`#${p.field}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(p.field)?.focus();
                        }}
                      >
                        {p.message}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : saveError ? (
              <div className="error" role="alert">
                Saving failed: {saveError} Your changes are still in the form.
              </div>
            ) : (
              <p className="muted">
                {dirty ? "You have unsaved changes." : "No unsaved changes."}
              </p>
            )}
          </div>
          <div className="save-bar-actions">
            {dirty ? (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setDraft(null);
                  setShowErrors(false);
                }}
              >
                Discard changes
              </button>
            ) : (
              <Link to="/" className="button ghost">
                Back to workspace
              </Link>
            )}
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void submit()}
            >
              {saving ? "Saving…" : "Save changes & update costs"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
