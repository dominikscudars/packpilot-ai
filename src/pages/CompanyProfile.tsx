import { useState } from "react";
import { useWorkspace } from "../components/WorkspaceProvider";
import { RequestState, message } from "../components/AsyncState";
import { QuantityField as Q } from "../components/QuantityField";
import type { RecordOf, Resources } from "../models/api";
function ProductEditor({
  record,
}: {
  record: RecordOf<Resources["products"]>;
}) {
  const { saveRecord } = useWorkspace();
  const { id: _id, companyId: _companyId, ...rest } = record;
  const [draft, setDraft] = useState<Resources["products"]>(() => ({
    name: rest.name,
    category: rest.category,
    storageRequirements: rest.storageRequirements,
    shelfLifeDays: rest.shelfLifeDays,
    shelfLifeNote: rest.shelfLifeNote,
    lengthMm: rest.lengthMm,
    widthMm: rest.widthMm,
    heightMm: rest.heightMm,
  }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <section className="panel">
      <h2>{record.name}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setNotice("");
          setError("");
          try {
            await saveRecord("products", record, draft);
            setNotice("Product saved.");
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="plain-fieldset" disabled={busy}>
          <div className="form-grid">
            <label>
              Product name
              <input
                required
                maxLength={200}
                value={draft.name}
                onChange={(e) => {
                  setDraft({ ...draft, name: e.target.value });
                  setNotice("");
                }}
              />
            </label>
            <label>
              Product category
              <input
                value={draft.category ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value || null })
                }
              />
            </label>
            <label>
              Storage requirements
              <textarea
                value={draft.storageRequirements ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    storageRequirements: e.target.value || null,
                  })
                }
              />
            </label>
            <Q
              label="Reported shelf life (days)"
              value={draft.shelfLifeDays}
              onChange={(shelfLifeDays) =>
                setDraft({ ...draft, shelfLifeDays })
              }
            />
          </div>
          <button>{busy ? "Saving…" : "Save product"}</button>
        </fieldset>
      </form>
      <RequestState error={error} />
      {notice && <p role="status">{notice}</p>}
      <p className="footnote">
        Reported storage and shelf life are not safety certification.
      </p>
    </section>
  );
}
export function CompanyProfile() {
  const { company, catalog, saveCompany } = useWorkspace();
  const [draft, setDraft] = useState(company);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR COMPANY DATA</span>
          <h1>Company profile</h1>
          <p>
            Changes are saved explicitly. Missing information is never filled
            with demo data.
          </p>
        </div>
      </header>
      <section className="panel">
        <h2>Company details</h2>
        {company.membershipRole !== "owner" && (
          <p className="notice">
            Only company owners can edit these details. Members can edit
            operational records.
          </p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setNotice("");
            setError("");
            try {
              await saveCompany(draft);
              setNotice("Company profile saved.");
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset
            disabled={busy || company.membershipRole !== "owner"}
            className="plain-fieldset"
          >
            <div className="form-grid">
              <label>
                Company name
                <input
                  required
                  maxLength={200}
                  value={draft.name}
                  onChange={(e) => {
                    setDraft({ ...draft, name: e.target.value });
                    setNotice("");
                  }}
                />
              </label>
              <label>
                Country
                <input
                  maxLength={200}
                  value={draft.country ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, country: e.target.value || null })
                  }
                />
              </label>
              <label>
                Industry category
                <input
                  maxLength={200}
                  value={draft.industryCategory ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      industryCategory: e.target.value || null,
                    })
                  }
                />
              </label>
            </div>
            <button>{busy ? "Saving…" : "Save company profile"}</button>
          </fieldset>
        </form>
        <RequestState error={error} />
        {notice && <p role="status">{notice}</p>}
      </section>
      {catalog.products.length ? (
        catalog.products.map((p) => <ProductEditor key={p.id} record={p} />)
      ) : (
        <section className="panel">
          <h2>No products yet</h2>
          <p>
            Create product and packaging catalog records through the company
            API. This integration edits existing records; full catalog
            onboarding is not available yet.
          </p>
        </section>
      )}
      <section className="panel">
        <h2>Packaging catalog</h2>
        <p className="muted">
          Scenario inputs are editable on Overview and Simulator. Saved
          scenarios keep snapshots; catalog changes do not silently rewrite
          them.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Format</th>
                <th>Material</th>
                <th>Commercial status</th>
              </tr>
            </thead>
            <tbody>
              {catalog.formats.map((f) => (
                <tr key={f.id}>
                  <td>
                    {catalog.products.find((p) => p.id === f.productId)?.name}
                  </td>
                  <td>{f.portionWeightGrams.value ?? "Unknown"} g</td>
                  <td>
                    {catalog.materials.find((m) => m.id === f.materialId)?.name}
                  </td>
                  <td>{f.commercialStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!catalog.formats.length && <p>No packaging formats yet.</p>}
        <h3>Machines</h3>
        {catalog.machines.map((m) => (
          <p key={m.id}>
            {m.model} · {m.dataQualityStatus}
          </p>
        ))}
        {!catalog.machines.length && <p>No machines recorded.</p>}
        <h3>Suppliers</h3>
        {catalog.suppliers.map((s) => (
          <p key={s.id}>
            {s.name} · {s.contactInformation ?? "Contact information unknown"}
          </p>
        ))}
        {!catalog.suppliers.length && <p>No suppliers recorded.</p>}
      </section>
    </>
  );
}
