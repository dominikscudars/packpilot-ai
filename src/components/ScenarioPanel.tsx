import { Icon } from "./Icon";
import { useEffect, useRef, useState } from "react";
import { useWorkspace, type Draft } from "./WorkspaceProvider";
import { ScenarioEditor } from "./ScenarioEditor";
import { message, RequestState } from "./AsyncState";
export function ScenarioPanel({
  draft,
  onChange,
  title,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  title: string;
}) {
  const { catalog, saveScenario, mode } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const currentDraft = useRef(draft);
  useEffect(() => {
    currentDraft.current = draft;
  }, [draft]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function save(asNew: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveScenario(draft, asNew);
      if (!mounted.current || currentDraft.current !== draft) return;
      onChange(saved);
      setNotice(
        mode === "demo"
          ? "Scenario saved in this browser."
          : "Scenario saved to your company.",
      );
    } catch (e) {
      if (mounted.current) setError(message(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="panel scenario-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SCENARIO WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <span className="section-icon">
          <Icon name="simulator" />
        </span>
      </div>
      <fieldset disabled={busy} className="plain-fieldset">
        <div className="form-grid">
          <label>
            Load saved scenario
            <select
              value={draft.id ?? ""}
              onChange={(e) => {
                const record = catalog.scenarios.find(
                  (s) => s.id === e.target.value,
                );
                if (record) {
                  onChange({
                    id: record.id,
                    name: record.name,
                    input: record.input,
                  });
                  setNotice("");
                  setError("");
                }
              }}
            >
              <option value="" disabled>
                Unsaved scenario
              </option>
              {catalog.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scenario name
            <input
              maxLength={200}
              value={draft.name}
              onChange={(e) => {
                onChange({ ...draft, name: e.target.value });
                setNotice("");
              }}
            />
          </label>
        </div>
        {draft.input.formats.length ? (
          <ScenarioEditor
            scenario={draft.input}
            onChange={(input) => {
              onChange({ ...draft, input });
              setNotice("");
            }}
          />
        ) : (
          <p className="empty">
            No packaging formats yet. Add products, materials and formats
            through the company API before building a scenario. No demo inputs
            have been copied.
          </p>
        )}
        <div className="actions">
          <button
            disabled={!draft.input.formats.length || !draft.name.trim()}
            onClick={() => void save(false)}
          >
            {busy ? "Saving…" : "Save scenario"}
          </button>
          <button
            className="secondary"
            disabled={!draft.input.formats.length || !draft.name.trim()}
            onClick={() => void save(true)}
          >
            Save as new scenario
          </button>
        </div>
      </fieldset>
      <RequestState error={error} />
      {notice && <p role="status">{notice}</p>}
      <p className="footnote">
        Edits are unsaved until you choose Save. Loading another scenario or
        changing company discards unsaved changes. Catalog edits do not rewrite
        saved snapshots.
      </p>
    </section>
  );
}
