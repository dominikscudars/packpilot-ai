import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Small, dependency-free charts. Colours are the first three slots of the
 * validated categorical palette (blue, orange, aqua), always paired with a
 * text label so identity never depends on colour alone.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"] as const;

/** Container width, so text stays readable at every screen size. */
function useWidth(fallback = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.round(entry.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** One whole split into parts, e.g. materials / labour / other. */
export function SegmentedBar({
  parts,
  format,
  label,
}: {
  parts: { name: string; value: number }[];
  format: (n: number) => string;
  label: string;
}) {
  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  return (
    <figure className="segmented" aria-label={label}>
      <div className="segmented-bar" aria-hidden="true">
        {shown.map((p, i) => (
          <span
            key={p.name}
            title={`${p.name}: ${format(p.value)}`}
            style={{
              flexGrow: p.value,
              background: SERIES[i % SERIES.length],
            }}
          />
        ))}
      </div>
      <figcaption>
        <ul className="legend">
          {shown.map((p, i) => (
            <li key={p.name}>
              <span
                className="swatch"
                style={{ background: SERIES[i % SERIES.length] }}
                aria-hidden="true"
              />
              <span className="legend-name">{p.name}</span>
              <strong>{format(p.value)}</strong>
              <span className="legend-share">
                {Math.round((p.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** Horizontal bars, one per row, value at the tip. */
export function BarList({
  rows,
  format,
  label,
}: {
  rows: { name: string; value: number | null; note?: ReactNode }[];
  format: (n: number | null) => string;
  label: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="bar-list" aria-label={label}>
      {rows.map((r) => (
        <li key={r.name}>
          <span className="bar-name">{r.name}</span>
          <span className="bar-track" aria-hidden="true">
            {r.value !== null && max > 0 && (
              <span
                className="bar-fill"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              />
            )}
          </span>
          <span className="bar-value">{format(r.value)}</span>
          {r.note && <span className="bar-note">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
};

/**
 * One series over time. Points from `projectedFrom` on are drawn dashed and
 * labelled as projected; an optional reference line marks a limit.
 */
export function LineChart({
  title,
  labels,
  values,
  projectedFrom,
  format,
  reference,
  color = SERIES[0],
}: {
  title: string;
  labels: string[];
  values: (number | null)[];
  projectedFrom: number;
  format: (n: number) => string;
  reference?: { value: number; label: string };
  color?: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const height = 180;
  const pad = { top: 14, right: 16, bottom: 28, left: 56 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const known = values.filter((v): v is number => v !== null);
  const top = nice(Math.max(...known, reference?.value ?? 0, 0) * 1.08);
  const n = values.length;
  const x = (i: number) => pad.left + (n <= 1 ? w / 2 : (i * w) / (n - 1));
  const y = (v: number) => pad.top + h - (v / top) * h;
  const path = (from: number, to: number) => {
    let d = "";
    for (let i = from; i <= to; i++) {
      const v = values[i];
      if (v === null || v === undefined) continue;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    }
    return d;
  };
  const lastActual = Math.max(0, projectedFrom - 1);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))));
  const ticks = [0, top / 2, top];
  const hovered = hover !== null ? values[hover] : null;

  return (
    <figure className="line-chart">
      <figcaption className="chart-title">{title}</figcaption>
      <div ref={ref} className="chart-area">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}: ${known.length ? `${format(known[0])} to ${format(known[known.length - 1])}` : "no data"}`}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - box.left - pad.left;
            const i = Math.round((px / Math.max(1, w)) * (n - 1));
            setHover(Math.min(n - 1, Math.max(0, i)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                className="grid"
                x1={pad.left}
                x2={pad.left + w}
                y1={y(t)}
                y2={y(t)}
              />
              <text
                className="axis"
                x={pad.left - 8}
                y={y(t) + 4}
                textAnchor="end"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            (i % every === 0 && n - 1 - i >= every) || i === n - 1 ? (
              <text
                key={i}
                className="axis"
                x={x(i)}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              >
                {l}
              </text>
            ) : null,
          )}
          {reference && (
            <g>
              <line
                className="reference"
                x1={pad.left}
                x2={pad.left + w}
                y1={y(reference.value)}
                y2={y(reference.value)}
              />
              <text
                className="reference-label"
                x={pad.left + w}
                y={y(reference.value) - 6}
                textAnchor="end"
              >
                {reference.label}
              </text>
            </g>
          )}
          <path
            d={path(0, lastActual)}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {projectedFrom < n && (
            <path
              d={path(lastActual, n - 1)}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeLinecap="round"
            />
          )}
          {hover !== null && hovered !== null && hovered !== undefined && (
            <g>
              <line
                className="crosshair"
                x1={x(hover)}
                x2={x(hover)}
                y1={pad.top}
                y2={pad.top + h}
              />
              <circle
                cx={x(hover)}
                cy={y(hovered)}
                r={5}
                fill={color}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(width - 140, Math.max(0, x(hover) - 70)),
            }}
          >
            <span>{labels[hover]}</span>
            <strong>
              {hovered === null || hovered === undefined
                ? "Unknown"
                : format(hovered)}
            </strong>
            <small>
              {hover >= projectedFrom ? "Projected" : "Actual / current"}
            </small>
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">{title}</th>
              <th scope="col">Type</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((l, i) => (
              <tr key={i}>
                <th scope="row">{l}</th>
                <td>
                  {values[i] === null ? "Unknown" : format(values[i] as number)}
                </td>
                <td>{i >= projectedFrom ? "Projected" : "Actual / current"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
