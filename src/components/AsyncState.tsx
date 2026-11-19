import { useEffect, useState } from "react";
import { ZodError } from "zod";
import { Guidance } from "./ApiResults";
import { fieldLabel, friendlyNote } from "./guidance";
export const message = (error: unknown) =>
  error instanceof ZodError
    ? error.issues
        .map((i) =>
          i.path.length
            ? `${fieldLabel(i.path.join("."))}: ${i.message}`
            : i.message,
        )
        .join(" ")
    : error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
/** Incomplete or invalid input (local validation or HTTP 400/422), as opposed to a network/server failure. */
const isInputProblem = (error: unknown) => {
  const status =
    error && typeof error === "object"
      ? ((error as { status?: unknown; statusCode?: unknown }).status ??
        (error as { statusCode?: unknown }).statusCode)
      : undefined;
  return error instanceof ZodError || status === 400 || status === 422;
};
/** Keyed results hide stale data synchronously; cleanup ignores late responses. */
export function useRequest<T>(inputKey: string, run: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const key = `${inputKey}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: string;
    guidance?: string;
  }>({ key: "" });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void run()
        .then((data) => {
          if (active) setState({ key, data });
        })
        .catch((error) => {
          if (active)
            setState(
              isInputProblem(error)
                ? { key, guidance: friendlyNote(message(error)).text }
                : { key, error: message(error) },
            );
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // Callers include every request dependency in the key; avoids object-identity refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return {
    ...(state.key === key ? state : { key }),
    retry: () => setRevision((r) => r + 1),
  };
}
export function RequestState({
  error,
  guidance,
  loading,
  onRetry,
}: {
  error?: string;
  guidance?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  if (guidance) return <Guidance items={[guidance]} />;
  if (error)
    return (
      <div className="error" role="alert">
        {error}
        {onRetry && (
          <div className="actions">
            <button className="secondary" onClick={onRetry}>
              Retry calculation
            </button>
          </div>
        )}
      </div>
    );
  if (loading) return <p role="status">Loading…</p>;
  return null;
}
