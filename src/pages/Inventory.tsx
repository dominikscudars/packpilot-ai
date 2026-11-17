export function Inventory() {
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">RECURRING OPERATIONS</span>
          <h1>Inventory planning</h1>
          <p>Prepare the data for your next planning step.</p>
        </div>
        <span className="chip">Not implemented yet</span>
      </header>
      <section className="panel placeholder">
        <div className="placeholder-icon" aria-hidden="true">
          ▤
        </div>
        <h2>Start with a reliable stock picture</h2>
        <p>
          Inventory forecasts and purchasing recommendations are planned for a
          later task. No stock levels or reorder quantities are calculated in
          this version.
        </p>
        <div className="checklist">
          <h3>Information to collect</h3>
          <ul>
            <li>On-hand packaging quantities, by material and format</li>
            <li>Expected production and packaging consumption</li>
            <li>Supplier lead times and minimum order quantities</li>
            <li>Explicit safety-stock assumptions</li>
          </ul>
        </div>
        <span className="chip">Supplier and inventory data: missing</span>
      </section>
    </>
  );
}
