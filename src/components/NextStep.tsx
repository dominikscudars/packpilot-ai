import { Link } from "react-router-dom";

/** "Next step" link at the bottom of each step page. */
export function NextStep({ to, label }: { to: string; label: string }) {
  return (
    <nav className="next-step" aria-label="Next step">
      <Link to={to} className="button">
        Next: {label} →
      </Link>
    </nav>
  );
}
