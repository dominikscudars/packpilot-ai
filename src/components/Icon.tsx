import type { CSSProperties } from "react";

const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  company:
    "M4 21V5l8-3v19 M12 8h8v13 M8 7v1 M8 12v1 M8 17v1 M16 12v1 M16 17v1 M2 21h20",
  simulator: "M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4",
  box: "m3 7 9-5 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5v5",
  wallet:
    "M20 7H5a2 2 0 0 1 0-4h13v4 M3 5v14a2 2 0 0 0 2 2h15V7 M20 11h-5v6h5 M16 14h1",
  scale: "M12 3v18 M5 21h14 M4 7h16 M6 7l-4 8h8L6 7z M18 7l-4 8h8l-4-8z",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  chart: "M4 20V4 M4 20h16 M8 16l4-5 3 3 5-7",
  survey: "M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3 M3 8l1 1 2-2",
  form: "M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3",
  spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3z",
  shield: "m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5l8-3z m-4 10 3 3 5-6",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  style,
}: {
  name: IconName;
  style?: CSSProperties;
}) {
  return (
    <svg
      className="icon"
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
