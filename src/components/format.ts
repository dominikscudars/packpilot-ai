export const number = (value: number | null, digits = 0) =>
  value === null
    ? "Unknown"
    : new Intl.NumberFormat("en-IE", { maximumFractionDigits: digits }).format(
        value,
      );
export const euro = (value: number | null, digits = 2) =>
  value === null
    ? "Unknown"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
