import { useId } from "react";
import type { NumericInput } from "../models/types";
export function NumericField({
  label,
  input,
  onChange,
  percent = false,
  step = "any",
}: {
  label: string;
  input: NumericInput;
  onChange: (input: NumericInput) => void;
  percent?: boolean;
  step?: string;
}) {
  const id = useId();
  const value =
    input.value === null
      ? ""
      : percent
        ? Number((input.value * 100).toFixed(9))
        : input.value;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        max={percent ? 100 : undefined}
        step={step}
        value={value}
        aria-describedby={`${id}-source`}
        onChange={(event) => {
          const raw = event.target.value;
          const numeric = raw === "" ? null : Number(raw);
          onChange({
            value: numeric === null ? null : percent ? numeric / 100 : numeric,
            source: "assumption",
            note: "User-entered scenario input; not independently verified.",
          });
        }}
      />
      <small id={`${id}-source`} title={input.note}>
        {input.value === null
          ? "Missing input"
          : input.source === "reported"
            ? "Company-reported estimate"
            : "Assumption"}
        <span className="source-note"> · {input.note}</span>
      </small>
    </div>
  );
}
