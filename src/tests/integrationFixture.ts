import { vi } from "vitest";
import type { AuthPort, Identity } from "../auth/session";
import { createDemoGateway } from "../demo/apiDemo";
import type { Resources } from "../models/api";
export function authFixture(
  initial: Identity | null = { userId: "user-a", accessToken: "access-a" },
) {
  let current = initial;
  const listeners = new Set<(identity: Identity | null) => void>();
  function emit(next: Identity | null) {
    current = next;
    listeners.forEach((fn) => fn(next));
  }
  const auth: AuthPort = {
    current: vi.fn(async () => current),
    refresh: vi.fn(async () => current),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    signIn: vi.fn(async () => {
      emit({ userId: "user-a", accessToken: "signed-in-token" });
    }),
    signOut: vi.fn(async () => emit(null)),
  };
  return { auth, emit };
}
export const json = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(status < 400 ? { data } : { error: { message: data } }),
    { status, headers: { "content-type": "application/json" } },
  );
export function apiFixture() {
  const demo = createDemoGateway(
    { getItem: () => null, setItem: () => {} },
    () => {},
  );
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const path = new URL(String(url)).pathname.replace("/api/v1/", "");
    const body = options?.body ? JSON.parse(String(options.body)) : undefined;
    if (path === "companies") return json(await demo.companies());
    if (path === "calculations/packaging-costs")
      return json(await demo.calculate(body));
    if (path === "calculations/compare-scenarios")
      return json(
        await demo.compare(
          body.baseline,
          body.alternative,
          body.sameProductAndDemand,
        ),
      );
    if (path === "calculations/inventory-plan")
      return json(await demo.inventory(body));
    const [, companyId, resource, id] = path.split("/");
    if (!resource) return json(await demo.saveCompany(companyId, body));
    const collection = resource as keyof Resources;
    if (options?.method === "GET")
      return json(await demo.list(companyId, collection));
    return json(await demo.save(companyId, collection, id ?? null, body));
  });
  return { fetcher, demo };
}
