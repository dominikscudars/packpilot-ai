import { useId } from "react";
import type { Quantity } from "../models/api";
export function QuantityField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Quantity;
  onChange: (value: Quantity) => void;
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
      <small id={`${id}-source`} className="field-source">
        {value.quality}
        {value.sourceNote ? ` · ${value.sourceNote}` : ""}
      </small>
    </div>
  );
}
