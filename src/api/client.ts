import type { AuthPort, Identity } from "../auth/session";
import type {
  CompanyRecord,
  Gateway,
  RecordOf,
  Resources,
} from "../models/api";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** One refresh for concurrent 401s. Never replay a request under a different identity. */
export function createApi(
  apiUrl: string,
  auth: AuthPort,
  userId: string,
  expired: () => void,
  fetcher: typeof fetch = fetch,
): Gateway {
  let refresh: Promise<Identity | null> | null = null;
  let invalid = false;
  async function expire(): Promise<never> {
    if (!invalid) {
      invalid = true;
      expired();
    }
    throw new ApiError(401, "Your session expired. Sign in again.");
  }
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    if (invalid) return expire();
    const current = await auth.current().catch(() => null);
    if (!current || current.userId !== userId) return expire();
    const send = (token: string) =>
      fetcher(`${apiUrl}/api/v1/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit",
        cache: "no-store",
      });
    let response = await send(current.accessToken);
    if (response.status === 401) {
      // A concurrent request/SDK timer may already have renewed this token.
      const latest = await auth.current().catch(() => null);
      let renewed = latest?.accessToken !== current.accessToken ? latest : null;
      if (!renewed) {
        refresh ??= auth
          .refresh()
          .catch(() => null)
          .finally(() => {
            refresh = null;
          });
        renewed = await refresh;
      }
      if (!renewed || renewed.userId !== userId || invalid) return expire();
      response = await send(renewed.accessToken);
      if (response.status === 401) return expire();
    }
    if (invalid) return expire();
    const payload = await response.json();
    if (!response.ok) {
      const details = payload.error?.details
        ?.map(
          (d: { path: string; message: string }) => `${d.path}: ${d.message}`,
        )
        .join(" ");
      throw new ApiError(
        response.status,
        `${payload.error?.message || `Request failed (${response.status}).`}${details ? ` ${details}` : ""}`,
      );
    }
    return payload.data as T;
  }
  async function list<T>(path: string): Promise<T[]> {
    const all: T[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await request<T[]>(`${path}?limit=100&offset=${offset}`);
      all.push(...page);
      if (page.length < 100) return all;
    }
  }
  const companyPath = (id: string) => `companies/${encodeURIComponent(id)}`;
  return {
    companies: () => list<CompanyRecord>("companies"),
    // These successful mutations are owner-only / assign ownership on the server.
    saveCompany: async (id, value) => ({
      ...(await request<Omit<CompanyRecord, "membershipRole">>(
        companyPath(id),
        "PATCH",
        value,
      )),
      membershipRole: "owner",
    }),
    createCompany: async (name) => ({
      ...(await request<Omit<CompanyRecord, "membershipRole">>(
        "companies",
        "POST",
        { name },
      )),
      membershipRole: "owner",
    }),
    list: <K extends keyof Resources>(id: string, resource: K) =>
      list<RecordOf<Resources[K]>>(`${companyPath(id)}/${resource}`),
    save: (id, resource, recordId, value) =>
      request(
        `${companyPath(id)}/${resource}${recordId ? `/${encodeURIComponent(recordId)}` : ""}`,
        recordId ? "PATCH" : "POST",
        value,
      ),
    calculate: (input) =>
      request("calculations/packaging-costs", "POST", input),
    compare: (baseline, alternative, sameProductAndDemand) =>
      request("calculations/compare-scenarios", "POST", {
        baseline,
        alternative,
        sameProductAndDemand,
      }),
    inventory: (input) => request("calculations/inventory-plan", "POST", input),
  };
}
