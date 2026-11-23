import { useState } from "react";
import { useWorkspace } from "../components/WorkspaceProvider";
import { OperationProfile, Suppliers } from "../components/ProfileSections";
import { EmptyState } from "./Workspace";
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
    </section>
  );
}
export function CompanyProfile() {
  const { company, catalog, saveCompany, baseline, onboarding, savedAt } =
    useWorkspace();
  const [draft, setDraft] = useState(company);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <div className="page profile">
      <header className="page-head profile-head">
        <div className="profile-id">
          <span className="profile-avatar" aria-hidden="true">
            {(company.name || "?")
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <span className="eyebrow">Company profile</span>
            <h1>{company.name}</h1>
            <p>
              {[company.country, company.industryCategory]
                .filter(Boolean)
                .join(" · ") || "Add your country and industry below."}
            </p>
          </div>
        </div>
      </header>
      {onboarding === "completed" ? (
        <OperationProfile input={baseline.input} savedAt={savedAt} />
      ) : (
        <section className="card section">
          <EmptyState
            title="No operation data yet"
            text="Enter your production and costs to see your pack sizes, packing line and data quality here."
          />
        </section>
      )}
      <Suppliers />
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
      {catalog.products.length
        ? catalog.products.map((p) => <ProductEditor key={p.id} record={p} />)
        : null}
      {catalog.formats.length + catalog.machines.length > 0 && (
        <section className="panel">
          <h2>Packaging catalog</h2>

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
                      {
                        catalog.materials.find((m) => m.id === f.materialId)
                          ?.name
                      }
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
        </section>
      )}
    </div>
  );
}
