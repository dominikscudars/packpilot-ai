import { useId } from "react";
import type { Quantity } from "../models/api";
export function QuantityField({
  label,
  value,
  onChange,
  suggestion,
}: {
  label: string;
  value: Quantity;
  onChange: (value: Quantity) => void;
  /** Optional one-click value, shown as "[value] – [source]". */
  suggestion?: { text: string; apply: () => Quantity };
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="decimal"
        type="text"
        value={value.value ?? ""}
        placeholder="Unknown"
        onChange={(e) =>
          onChange(
            e.target.value === ""
              ? { value: null, quality: "missing" }
              : {
                  value: e.target.value,
                  quality: "assumption",
                  sourceNote:
                    "User-entered planning assumption; not independently verified.",
                },
          )
        }
        aria-describedby={`${id}-source`}
      />
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
        {value.quality}
        {value.sourceNote ? ` · ${value.sourceNote}` : ""}
      </small>
    </div>
  );
}
