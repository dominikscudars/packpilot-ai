/** Founder-facing wording for engine notes. `attention` marks real operational risks (over-capacity); the rest is setup guidance. */
export type Note = { text: string; attention?: boolean };

const NOTES: Record<string, Note> = {
  // Packaging engine (backend, also used by the demo)
  "Exact production fulfillment required reallocation away from the requested mix. Review each format mass deviation.":
    {
      text: "We nudged the pack-size mix so every kilogram fits into whole packages. Check the packed kg per pack size below.",
    },
  "Equipment is unassigned for a positive-share format; recurring costs and investment are unknown.":
    {
      text: "Choose a machine for each pack size to see running costs and investment.",
    },
  "Material cost is unknown: at least one required price is missing.": {
    text: "Add the price of each packaging material and label to see material costs.",
  },
  "Labor cost is unknown: a rate, throughput or operator count is missing.": {
    text: "Add your labor rate, machine speed and number of operators to see labor costs.",
  },
  "Some machine-hours or person-hours are unknown.": {
    text: "Add machine speed and staffing to estimate machine and labor hours.",
  },
  "Recurring operating costs are incomplete; net investment savings cannot be established.":
    {
      text: "Optional: add monthly maintenance and other running costs to compare equipment investments.",
    },
  // Earlier frontend calculator
  "Material prices are missing; material and total operating costs are unknown.":
    {
      text: "Add the price of each packaging material and label to see material costs.",
    },
  "Labor pricing or processing inputs are missing; labor and total operating costs are unknown.":
    {
      text: "Add your labor pricing and processing time to see labor costs.",
    },
  "Processing time or staffing is missing; labor hours are unknown.": {
    text: "Add processing time and staffing to estimate labor hours.",
  },
};

export function friendlyNote(raw: string): Note {
  const known = NOTES[raw];
  if (known) return known;
  const left = /^(\S+) kg cannot be packed into/.exec(raw);
  if (left)
    return {
      text: `${left[1]} kg doesn't fill a whole package and stays unpacked. Adjust pack sizes or production to pack it all.`,
    };
  const required = /^(.+) is required\.$/.exec(raw);
  if (required)
    return { text: `Add ${required[1].toLowerCase()} to see your results.` };
  const machine = /^Machine (.+) exceeds its declared available hours\.$/.exec(
    raw,
  );
  if (machine)
    return {
      text: `Machine ${machine[1]} is booked beyond its available hours. Add machine time or lower production.`,
      attention: true,
    };
  return { text: raw };
}

/** "input.formats.0.materialEuroPerPackage" → "Pack size 1 · material euro per package". */
export function fieldLabel(path: string): string {
  const parts = path.split(".").filter((p) => p !== "input");
  const words = (s: string) =>
    s.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const named: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const index = Number(parts[i + 1]);
    if (parts[i] === "formats" && Number.isInteger(index)) {
      named.push(`Pack size ${index + 1}`);
      i++;
    } else if (parts[i] === "machines" && Number.isInteger(index)) {
      named.push(`Machine ${index + 1}`);
      i++;
    } else if (!/^\d+$/.test(parts[i])) named.push(words(parts[i]));
  }
  const text = named.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
