import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ScenarioInput } from "../models/api";
import { useWorkspace } from "../components/WorkspaceProvider";
import { message } from "../components/AsyncState";
import { setupProblems, type SetupProblem } from "../setup/setupState";
import {
  InputReview,
  LabourSection,
  MaterialsSection,
  ProductionSection,
} from "../onboarding/FormSections";
import {
  STEPS,
  blankScenario,
  editable,
  problemsForStep,
  stepOf,
} from "../onboarding/scenarioForm";
import { AccountControls, Brand } from "../components/AppHeader";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { EXAMPLE_PROFILE } from "../demo/apiDemo";

const LAST = STEPS.length - 1;
/**
 * First visit: a full-screen, step-by-step form for the company's own
 * production and cost data. Nothing is prefilled with sample figures, and no
 * results are shown until the data is saved.
 */
export function Onboarding() {
  const {
    baseline,
    setBaseline,
    saveScenario,
    saveCompany,
    company,
    mode,
    onboarding,
    completeSetup,
    skipSetup,
    draft,
    setDraft,
  } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = Math.min(LAST, Math.max(0, Number(params.get("step")) || 0));
  const goTo = (n: number) =>
    setParams(n === 0 ? {} : { step: String(n) }, { replace: false });
  const saved =
    baseline.input.formats.length > 0
      ? editable(baseline.input)
      : blankScenario();
  const input = draft ? editable(draft) : saved;
  const [name, setName] = useState(
    mode === "demo" && company.name === "Demo company" ? "" : company.name,
  );
  const [shown, setShown] = useState<SetupProblem[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the step heading when the step changes (keyboard and
  // screen-reader users land at the start of the new step).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo?.(0, 0);
  }, [step]);

  const change = (next: ScenarioInput) => {
    setDraft(next);
    setSaveError("");
    // Re-check only the problems already on screen, so fixed fields clear.
    if (shown.length) {
      const now = setupProblems(next);
      setShown(shown.filter((p) => now.some((n) => n.field === p.field)));
    }
  };
  const live = setupProblems(input);
  const errorFor = (field: string) =>
    shown.some((p) => p.field === field)
      ? live
          .filter((p) => p.field === field)
          .map((p) => p.message)
          .join(" ") || undefined
      : undefined;

  function show(problems: SetupProblem[]) {
    setShown(problems);
    requestAnimationFrame?.(() =>
      document.getElementById(problems[0].field)?.focus(),
    );
  }

  function next() {
    const problems = problemsForStep(input, step);
    if (problems.length) return show(problems);
    setShown([]);
    goTo(step + 1);
  }

  async function finish() {
    const problems = setupProblems(input);
    if (problems.length) {
      const target = stepOf(problems[0]);
      setShown(problems.filter((p) => stepOf(p) === target));
      goTo(target);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      if (mode === "demo" && name.trim() && name.trim() !== company.name)
        await saveCompany({ ...company, name: name.trim() });
      const result = await saveScenario(
        { id: baseline.id, name: baseline.name || "My operation", input },
        baseline.id === null,
      );
      setBaseline(result);
      completeSetup(result);
      setDraft(null);
      navigate("/");
    } catch (e) {
      // The entered data stays in the form; nothing is unlocked.
      setSaveError(message(e));
    } finally {
      setSaving(false);
    }
  }

  /** Demo only: save OG TOFU's pilot reference data (unknowns stay unknown). */
  async function loadExample() {
    setSaving(true);
    setSaveError("");
    try {
      await saveCompany({
        ...company,
        name: "OG TOFU",
        country: "Latvia",
        industryCategory: "Plant-based food manufacturing",
      });
      const result = await saveScenario(
        { id: baseline.id, name: EXAMPLE_PROFILE, input: createDemoScenario() },
        baseline.id === null,
      );
      setBaseline(result);
      completeSetup(result);
      setDraft(null);
      navigate("/");
    } catch (e) {
      setSaveError(message(e));
    } finally {
      setSaving(false);
    }
  }

  const stepProblems = shown.filter((p) => stepOf(p) === step);

  return (
    <div className="onboarding">
      <header className="ob-header">
        <Brand />
        <AccountControls compact />
      </header>
      <main id="main" className="ob-main" tabIndex={-1}>
        <div className="ob-intro">
          <span className="eyebrow">
            {onboarding === "skipped"
              ? "Finish setting up"
              : "Set up your workspace"}
          </span>
          <h1>Enter your data</h1>
          <p>About three minutes. Leave anything you don't know empty.</p>
          {mode === "demo" && step === 0 && (
            <div className="notice example-offer">
              <p>
                <strong>Just looking around?</strong> Try it with a real Latvian
                tofu producer's numbers.
              </p>
              <button
                type="button"
                className="secondary"
                disabled={saving}
                onClick={() => void loadExample()}
              >
                Load example company (OG TOFU)
              </button>
            </div>
          )}
        </div>

        <ol className="stepper" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={i === step ? "current" : i < step ? "done" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="stepper-dot" aria-hidden="true">
                {i < step ? "✓" : i + 1}
              </span>
              <span className="stepper-label">{s.short}</span>
            </li>
          ))}
        </ol>
        <div
          className="stepper-bar"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${STEPS.length}`}
        >
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <section className="ob-card" aria-labelledby="step-title">
          <div className="ob-card-head">
            <span className="step-count">
              Step {step + 1} of {STEPS.length}
            </span>
            <h2 id="step-title" ref={heading} tabIndex={-1}>
              {STEPS[step].title}
            </h2>
          </div>

          <fieldset className="plain-fieldset" disabled={saving}>
            {step === 0 &&
              (mode === "demo" ? (
                <div className="field">
                  <label htmlFor="company-name">Company name (optional)</label>
                  <input
                    id="company-name"
                    value={name}
                    maxLength={200}
                    placeholder="e.g. Riga Fresh Foods"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              ) : (
                <p className="company-line">
                  Company: <strong>{company.name}</strong>
                </p>
              ))}
            {step === 0 && (
              <ProductionSection
                input={input}
                change={change}
                errorFor={errorFor}
              />
            )}
            {step === 1 && (
              <MaterialsSection
                input={input}
                change={change}
                errorFor={errorFor}
              />
            )}
            {step === 2 && (
              <LabourSection
                input={input}
                change={change}
                errorFor={errorFor}
              />
            )}
            {step === 3 && <InputReview input={input} onEdit={goTo} />}
          </fieldset>

          {stepProblems.length > 0 && (
            <div className="error" role="alert">
              <p>
                Please check{" "}
                {stepProblems.length === 1 ? "this field" : "these fields"}:
              </p>
              <ul>
                {stepProblems.map((p) => (
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
          )}
          {saveError && (
            <div className="error" role="alert">
              Saving failed: {saveError} Your answers are still in the form.
            </div>
          )}
        </section>

        <div className="ob-actions">
          <div>
            {step > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setShown([]);
                  goTo(step - 1);
                }}
              >
                ← Back
              </button>
            )}
          </div>
          <div className="ob-actions-main">
            <button
              type="button"
              className="ghost skip-button"
              disabled={saving}
              onClick={() => {
                skipSetup();
                navigate("/");
              }}
            >
              Skip for now
            </button>
            {step < LAST ? (
              <button type="button" onClick={next}>
                Continue
              </button>
            ) : null}
            {step === LAST && (
              <button
                type="button"
                className="primary-large"
                disabled={saving}
                onClick={() => void finish()}
              >
                {saving ? "Saving…" : "Show my workspace"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
