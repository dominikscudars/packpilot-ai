import { createContext, useContext, useState, type ReactNode } from "react";
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
export interface Draft {
  id: string | null;
  name: string;
  input: ScenarioInput;
}
interface WorkspaceContext {
  gateway: Gateway;
  mode: "demo" | "authenticated";
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
function LoadedWorkspace({
  initial,
  company: initialCompany,
  gateway,
  mode,
  onCompany,
  children,
}: {
  initial: Catalog;
  company: CompanyRecord;
  gateway: Gateway;
  mode: "demo" | "authenticated";
  onCompany: (company: CompanyRecord) => void;
  children: ReactNode;
}) {
  const [catalog, setCatalog] = useState(initial);
  const [company, setCompany] = useState(initialCompany);
  const [baseline, setBaseline] = useState(() => draftFrom(initial));
  const [alternative, setAlternative] = useState<Draft>(() => ({
    ...draftFrom(initial),
    id: null,
    name: "Alternative scenario",
  }));
  const value: WorkspaceContext = {
    gateway,
    mode,
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
      return { id: saved.id, name: saved.name, input: saved.input };
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function CompanyLoader(props: {
  company: CompanyRecord;
  gateway: Gateway;
  mode: "demo" | "authenticated";
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
      <section className="panel">
        <RequestState error={state.error} loading={!state.error} />
        {state.error && (
          <button onClick={() => setRetry((r) => r + 1)}>
            Retry loading company
          </button>
        )}
      </section>
    );
  return <LoadedWorkspace {...props} initial={state.data} />;
}
export function WorkspaceProvider({
  gateway,
  mode,
  children,
  exit,
}: {
  gateway: Gateway;
  mode: "demo" | "authenticated";
  children: ReactNode;
  exit: () => void;
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
  return (
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
      {mode === "demo" && (
        <div className="notice demo-banner">
          Demo: values marked “OG TOFU” come from an interview with the company;
          estimates are labelled as such. Everything stays in this browser and
          is never uploaded.
        </div>
      )}
      {!companies ? (
        <main>
          <RequestState error={state.error} loading={!state.error} />
          {state.error && (
            <button onClick={() => setRetry((r) => r + 1)}>
              Retry companies
            </button>
          )}
        </main>
      ) : company ? (
        <CompanyLoader
          key={company.id}
          company={company}
          gateway={gateway}
          mode={mode}
          onCompany={(c) =>
            setOverrides((current) => ({ ...current, [c.id]: c }))
          }
        >
          {children}
        </CompanyLoader>
      ) : (
        <main className="auth-screen">
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
