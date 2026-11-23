import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type {
  Catalog,
  CompanyRecord,
  Gateway,
  RecordOf,
  Resources,
  ScenarioInput,
} from "../models/api";
import { missing } from "../../backend/src/domain/inputs";
import { useRequest, RequestState, message } from "./AsyncState";
import {
  loadDraft,
  loadSetupRecord,
  loadSkipped,
  saveDraft,
  saveSetupRecord,
  saveSkipped,
  scopeKey,
  setupProblems,
  type OnboardingStatus,
} from "../setup/setupState";
export interface LastComparison {
  key: string;
  kind: string;
  data: Awaited<ReturnType<Gateway["compare"]>>;
}
export interface Draft {
  id: string | null;
  name: string;
  input: ScenarioInput;
}
interface WorkspaceContext {
  gateway: Gateway;
  mode: "demo" | "authenticated";
  /** Readiness, drafts and caches are scoped to this mode/user/company key. */
  scope: string;
  /** Setup gate: saved inputs meet the engine's minimum requirements. */
  setupReady: boolean;
  /**
   * Onboarding state for this scope: "none" shows only data entry,
   * "skipped" opens the workspace without any results, "completed" has
   * saved company data. Persisted per scope, so refreshes and direct links
   * see the same state. UI only: backend auth and membership still apply.
   */
  onboarding: OnboardingStatus;
  /** Records successful setup for the saved scenario. */
  completeSetup: (saved: Draft) => void;
  /** "Skip for now": open the workspace with empty states, no results. */
  skipSetup: () => void;
  /** Companies this account can open, and switching between them. */
  companies: CompanyRecord[];
  selectCompany: (id: string) => void;
  /** Leaves the demo or signs out. */
  exit: () => void;
  /** When the saved inputs were last saved in this workspace (ISO), if known. */
  savedAt: string | null;
  /** Last "Test a cost change" result, tied to the inputs it was made on. */
  lastComparison: LastComparison | null;
  setLastComparison: (value: LastComparison | null) => void;
  /** Unsaved data-entry draft (null = none). */
  draft: ScenarioInput | null;
  setDraft: (input: ScenarioInput | null) => void;
  company: CompanyRecord;
  catalog: Catalog;
  baseline: Draft;
  alternative: Draft;
  setBaseline: (draft: Draft) => void;
  setAlternative: (draft: Draft) => void;
  saveScenario: (draft: Draft, asNew: boolean) => Promise<Draft>;
  saveCompany: (company: CompanyRecord) => Promise<void>;
  saveRecord: <K extends keyof Resources>(
    resource: K,
    record: RecordOf<Resources[K]>,
    value: Resources[K],
  ) => Promise<void>;
  /** Creates a new company record (e.g. a supplier). */
  addRecord: <K extends keyof Resources>(
    resource: K,
    value: Resources[K],
  ) => Promise<void>;
}
const Context = createContext<WorkspaceContext | null>(null);
function draftFrom(catalog: Catalog): Draft {
  const first = catalog.scenarios[0];
  if (first) return { id: first.id, name: first.name, input: first.input };
  return {
    id: null,
    name: "New scenario",
    input: {
      monthlyProductionKg: missing(),
      formats: catalog.formats.slice(0, 20).map((f) => ({
        id: f.id,
        portionWeightGrams: f.portionWeightGrams,
        materialCost: f.materialCost,
        allocationPercent: missing(),
        machineId: null,
      })),
      machines: catalog.machines
        .slice(0, 20)
        .map(
          ({
            id,
            throughput,
            operators,
            investmentEuro,
            maintenanceEuroPerMonth,
            availableHoursPerMonth,
          }) => ({
            id,
            throughput,
            operators,
            investmentEuro,
            maintenanceEuroPerMonth,
            availableHoursPerMonth,
          }),
        ),
      labor: { method: "perPackage", euroPerPackage: missing() },
      additionalOperatingEuroPerMonth: missing(),
    },
  };
}
/** Saved scenario a setup record points to, if it still exists and is valid. */
function restoredSetup(
  mode: "demo" | "authenticated",
  scope: string,
  catalog: Catalog,
): Draft | null {
  if (mode === "authenticated") {
    // Signed-in readiness comes from the company's saved data on the server.
    const first = catalog.scenarios[0];
    return first && setupProblems(first.input).length === 0
      ? { id: first.id, name: first.name, input: first.input }
      : null;
  }
  const record = loadSetupRecord(scope);
  const saved = record
    ? catalog.scenarios.find((s) => s.id === record.scenarioId)
    : undefined;
  return saved && setupProblems(saved.input).length === 0
    ? { id: saved.id, name: saved.name, input: saved.input }
    : null;
}
interface Account {
  companies: CompanyRecord[];
  selectCompany: (id: string) => void;
  exit: () => void;
}
function LoadedWorkspace({
  initial,
  company: initialCompany,
  gateway,
  mode,
  userId,
  onCompany,
  account,
  children,
}: {
  initial: Catalog;
  company: CompanyRecord;
  gateway: Gateway;
  mode: "demo" | "authenticated";
  userId: string | null;
  onCompany: (company: CompanyRecord) => void;
  account: Account;
  children: ReactNode;
}) {
  const scope = scopeKey(mode, userId, initialCompany.id);
  const [catalog, setCatalog] = useState(initial);
  const [company, setCompany] = useState(initialCompany);
  const [restored] = useState(() => restoredSetup(mode, scope, initial));
  const [setupReady, setSetupReady] = useState(restored !== null);
  const [skipped, setSkipped] = useState(() => loadSkipped(scope));
  const onboarding: OnboardingStatus = setupReady
    ? "completed"
    : skipped
      ? "skipped"
      : "none";
  const [draft, setDraftState] = useState(() => loadDraft(scope));
  const [savedAt, setSavedAt] = useState<string | null>(() =>
    mode === "demo" ? (loadSetupRecord(scope)?.completedAt ?? null) : null,
  );
  const [lastComparison, setLastComparison] = useState<LastComparison | null>(
    null,
  );
  const setDraft = useCallback(
    (input: ScenarioInput | null) => {
      setDraftState(input);
      saveDraft(scope, input);
    },
    [scope],
  );
  const [baseline, setBaseline] = useState(
    () => restored ?? draftFrom(initial),
  );
  const [alternative, setAlternative] = useState<Draft>(() => ({
    ...draftFrom(initial),
    id: null,
    name: "Alternative scenario",
  }));
  const value: WorkspaceContext = {
    gateway,
    mode,
    scope,
    setupReady,
    onboarding,
    completeSetup(saved) {
      if (mode === "demo" && saved.id) saveSetupRecord(scope, saved.id);
      setSetupReady(true);
    },
    skipSetup() {
      saveSkipped(scope);
      setSkipped(true);
    },
    ...account,
    draft,
    setDraft,
    savedAt,
    lastComparison,
    setLastComparison,
    company,
    catalog,
    baseline,
    alternative,
    setBaseline,
    setAlternative,
    async saveCompany(next) {
      const saved = await gateway.saveCompany(company.id, {
        name: next.name,
        country: next.country,
        industryCategory: next.industryCategory,
      });
      const updated = { ...saved, membershipRole: company.membershipRole };
      setCompany(updated);
      onCompany(updated);
    },
    async saveRecord(resource, record, data) {
      const saved = await gateway.save(company.id, resource, record.id, data);
      setCatalog((current) => ({
        ...current,
        [resource]: current[resource].map((r) =>
          r.id === saved.id ? saved : r,
        ),
      }));
    },
    async addRecord(resource, data) {
      const saved = await gateway.save(company.id, resource, null, data);
      setCatalog((current) => ({
        ...current,
        [resource]: [...current[resource], saved],
      }));
    },
    async saveScenario(draft, asNew) {
      const saved = await gateway.save(
        company.id,
        "scenarios",
        asNew ? null : draft.id,
        { name: draft.name, kind: "modeled", input: draft.input },
      );
      setCatalog((current) => ({
        ...current,
        scenarios: [
          ...current.scenarios.filter((r) => r.id !== saved.id),
          saved,
        ],
      }));
      setSavedAt(new Date().toISOString());
      return { id: saved.id, name: saved.name, input: saved.input };
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function CompanyLoader(props: {
  /** Company switcher and exit, shown while the company's data loads. */
  loadingBar: ReactNode;
  account: Account;
  company: CompanyRecord;
  gateway: Gateway;
  mode: "demo" | "authenticated";
  userId: string | null;
  onCompany: (company: CompanyRecord) => void;
  children: ReactNode;
}) {
  const [retry, setRetry] = useState(0);
  const state = useRequest(
    `${props.company.id}:${retry}`,
    async (): Promise<Catalog> => {
      const { gateway, company } = props;
      const [
        products,
        materials,
        formats,
        machines,
        inventory,
        suppliers,
        scenarios,
      ] = await Promise.all([
        gateway.list(company.id, "products"),
        gateway.list(company.id, "materials"),
        gateway.list(company.id, "formats"),
        gateway.list(company.id, "machines"),
        gateway.list(company.id, "inventory"),
        gateway.list(company.id, "suppliers"),
        gateway.list(company.id, "scenarios"),
      ]);
      return {
        products,
        materials,
        formats,
        machines,
        inventory,
        suppliers,
        scenarios,
      };
    },
  );
  if (!state.data)
    return (
      <>
        {props.loadingBar}
        <section className="panel loading-panel">
          <RequestState error={state.error} loading={!state.error} />
          {state.error && (
            <button onClick={() => setRetry((r) => r + 1)}>
              Retry loading company
            </button>
          )}
        </section>
      </>
    );
  return <LoadedWorkspace {...props} initial={state.data} />;
}
export function WorkspaceProvider({
  gateway,
  mode,
  children,
  exit,
  userId = null,
}: {
  gateway: Gateway;
  mode: "demo" | "authenticated";
  children: ReactNode;
  exit: () => void;
  userId?: string | null;
}) {
  const [retry, setRetry] = useState(0),
    [selected, setSelected] = useState("");
  const [overrides, setOverrides] = useState<Record<string, CompanyRecord>>({});
  const [newName, setNewName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const state = useRequest(`companies:${retry}`, () => gateway.companies());
  const companies = state.data?.map((c) => overrides[c.id] ?? c);
  const company = companies?.find((c) => c.id === selected) ?? companies?.[0];
  const account: Account = {
    companies: companies ?? [],
    selectCompany: setSelected,
    exit,
  };
  // Once a company is open, the shell renders the company switcher and the
  // exit action in its own header; this bar covers loading and errors.
  const bar = (
    <>
      <div className="account-bar">
        <strong>
          {mode === "demo"
            ? "Local demo · browser only"
            : "Authenticated company workspace"}
        </strong>
        {!!companies?.length && (
          <label>
            Company
            <select
              aria-label="Active company"
              value={company?.id ?? ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="secondary" onClick={exit}>
          {mode === "demo" ? "Exit demo" : "Sign out"}
        </button>
      </div>
    </>
  );
  return (
    <>
      {!companies ? (
        <main>
          {bar}
          <RequestState error={state.error} loading={!state.error} />
          {state.error && (
            <button onClick={() => setRetry((r) => r + 1)}>
              Retry companies
            </button>
          )}
        </main>
      ) : company ? (
        <CompanyLoader
          loadingBar={bar}
          account={account}
          key={company.id}
          company={company}
          gateway={gateway}
          mode={mode}
          userId={userId}
          onCompany={(c) =>
            setOverrides((current) => ({ ...current, [c.id]: c }))
          }
        >
          {children}
        </CompanyLoader>
      ) : (
        <main className="auth-screen">
          {bar}
          <section className="panel">
            <h1>No companies yet</h1>
            <p>
              Ask an owner to add your account, or create a new company. Your
              browser demo will not be copied.
            </p>
            <button
              className="secondary"
              onClick={() => setRetry((r) => r + 1)}
            >
              Refresh access
            </button>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const created = await gateway.createCompany(newName);
                  setSelected(created.id);
                  setRetry((r) => r + 1);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                New company name
                <input
                  required
                  maxLength={200}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <button disabled={busy}>Create company</button>
            </form>
            <RequestState error={error} />
          </section>
        </main>
      )}
    </>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace provider missing");
  return context;
}
