import { useId } from "react";
import type { Quantity } from "../models/api";

const QUALITY_TEXT: Record<Quantity["quality"], string> = {
  reported: "reported",
  assumption: "your entry",
  missing: "not entered",
  verified: "verified",
};

/** Accepts a decimal comma ("0,07" → "0.07"); other text is kept for validation. */
export function normalizeDecimal(raw: string): string {
  const text = raw.trim().replace(/\s/g, "");
  return /^-?\d*,\d*$/.test(text) ? text.replace(",", ".") : text;
}

export function QuantityField({
  label,
  value,
  onChange,
  suggestion,
  id: fieldId,
  error,
}: {
  label: string;
  value: Quantity;
  onChange: (value: Quantity) => void;
  /** Optional one-click value, shown as "[value] – [source]". */
  suggestion?: { text: string; apply: () => Quantity };
  /** Stable id for jump links and focus (defaults to a generated id). */
  id?: string;
  /** Validation message; marks the field as needing attention. */
  error?: string;
}) {
  const generated = useId();
  const id = fieldId ?? generated;
  return (
    <div className={`field${error ? " field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="decimal"
        type="text"
        value={value.value ?? ""}
        placeholder="Unknown"
        aria-invalid={error ? true : undefined}
        onChange={(e) =>
          onChange(
            e.target.value.trim() === ""
              ? { value: null, quality: "missing" }
              : {
                  value: normalizeDecimal(e.target.value),
                  quality: "assumption",
                  sourceNote:
                    "User-entered planning assumption; not independently verified.",
                },
          )
        }
        aria-describedby={`${id}-source${error ? ` ${id}-error` : ""}`}
      />
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
      {suggestion && value.value === null && (
        <button
          type="button"
          className="suggestion-chip"
          aria-label={`Use ${suggestion.text} for ${label}`}
          onClick={() => onChange(suggestion.apply())}
        >
          {suggestion.text}
        </button>
      )}
      <small id={`${id}-source`} className="field-source">
        {QUALITY_TEXT[value.quality] ?? value.quality}
        {value.sourceNote ? ` · ${value.sourceNote}` : ""}
      </small>
    </div>
  );
}
