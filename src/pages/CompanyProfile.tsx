import { useWorkspace } from "../components/WorkspaceProvider";
import { NumericField } from "../components/NumericField";
import { ScenarioEditor } from "../components/ScenarioEditor";
import { evaluate } from "../components/Results";
export function CompanyProfile() {
  const { workspace, update } = useWorkspace();
  const { error } = evaluate(workspace.baseline, workspace);
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">INPUTS & ASSUMPTIONS</span>
          <h1>Company profile</h1>
          <p>
            Edit the information behind your current-operation calculations.
          </p>
        </div>
        <span className="chip">Browser storage</span>
      </header>
      <section className="panel">
        <h2>Company details</h2>
        <div className="two-fields">
          <div className="field">
            <label htmlFor="company-name">Company name</label>
            <input
              id="company-name"
              value={workspace.company.name}
              onChange={(e) =>
                update({
                  ...workspace,
                  company: { ...workspace.company, name: e.target.value },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="company-country">Country</label>
            <input
              id="company-country"
              value={workspace.company.country ?? ""}
              onChange={(e) =>
                update({
                  ...workspace,
                  company: { ...workspace.company, country: e.target.value },
                })
              }
            />
          </div>
        </div>
        <p className="muted">
          Company details originate from the README; edits are user-entered and
          unverified.
        </p>
        {workspace.products.map((product, index) => (
          <div key={product.id} className="product-details">
            <div className="field">
              <label htmlFor={`product-${product.id}`}>Product name</label>
              <input
                id={`product-${product.id}`}
                value={product.name}
                onChange={(e) => {
                  const products = structuredClone(workspace.products);
                  products[index].name = e.target.value;
                  update({ ...workspace, products });
                }}
              />
            </div>
            <p className="muted">
              {product.category} · {product.storage} · Reported shelf life:{" "}
              {product.shelfLifeDays?.value ?? "unknown"} days
            </p>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Current-operation inputs</h2>
        <ScenarioEditor
          scenario={workspace.baseline}
          onChange={(baseline) => update({ ...workspace, baseline })}
        />
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Machinery & processing</h2>
        <p className="muted">
          Shared by the current and alternative scenarios. Each format runs in
          separate, whole machine cycles.
        </p>
        {workspace.machines.map((machine, index) => (
          <div key={machine.id}>
            <h3>{machine.name}</h3>
            <div className="format-edit-grid">
              {(["packagesPerCycle", "cycleSeconds", "workers"] as const).map(
                (field, fi) => (
                  <NumericField
                    key={field}
                    label={
                      [
                        "Packages per cycle",
                        "Cycle time (seconds)",
                        "Workers per machine",
                      ][fi]
                    }
                    input={machine[field]}
                    step={field === "cycleSeconds" ? "any" : "1"}
                    onChange={(value) => {
                      const machines = structuredClone(workspace.machines);
                      machines[index][field] = value;
                      update({ ...workspace, machines });
                    }}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Data still to collect</h2>
        <p className="muted">
          Material dimensions, supplier details, stock counts, machine
          availability and hourly wages have not been provided. No values have
          been invented for these fields.
        </p>
      </section>
    </>
  );
}
