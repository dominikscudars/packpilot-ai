import { expect, it, vi } from "vitest";
import { createApi } from "../api/client";
import { authFixture, json } from "./integrationFixture";
import { createDemoScenario } from "../../backend/src/domain/demo";
it("sends bearer tokens and no cookies, follows pagination, and leaves requests unmodified", async () => {
  const { auth } = authFixture();
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    json(
      String(url).includes("offset=0")
        ? Array.from({ length: 100 }, (_, id) => ({ id: String(id) }))
        : [{ id: "last" }],
    ),
  );
  const client = createApi(
    "http://localhost:3001",
    auth,
    "user-a",
    vi.fn(),
    fetcher,
  );
  expect(await client.companies()).toHaveLength(101);
  expect(String(fetcher.mock.calls[1][0])).toContain("offset=100");
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    credentials: "omit",
    cache: "no-store",
    headers: { Authorization: "Bearer access-a" },
  });
});
it("renews a rejected token once and retries the same body", async () => {
  const { auth, emit } = authFixture();
  vi.mocked(auth.refresh).mockImplementation(async () => {
    const identity = { userId: "user-a", accessToken: "renewed" };
    emit(identity);
    return identity;
  });
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json("Expired", 401))
    .mockResolvedValueOnce(json({ totalPackages: 1300 }));
  const expire = vi.fn();
  const client = createApi(
    "http://localhost:3001",
    auth,
    "user-a",
    expire,
    fetcher,
  );
  await client.calculate(createDemoScenario());
  expect(auth.refresh).toHaveBeenCalledOnce();
  expect(expire).not.toHaveBeenCalled();
  expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
    Authorization: "Bearer renewed",
  });
  expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body);
});
it("shares one refresh across concurrent 401 responses", async () => {
  const { auth, emit } = authFixture();
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(auth.refresh).mockImplementation(async () => {
    await ready;
    const identity = { userId: "user-a", accessToken: "renewed" };
    emit(identity);
    return identity;
  });
  const fetcher = vi.fn<typeof fetch>(async (_url, init) =>
    new Headers(init?.headers).get("Authorization") === "Bearer renewed"
      ? json([])
      : json("Expired", 401),
  );
  const client = createApi(
    "http://localhost:3001",
    auth,
    "user-a",
    vi.fn(),
    fetcher,
  );
  const requests = [client.companies(), client.list("company", "products")];
  await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalledOnce());
  release();
  await Promise.all(requests);
  expect(auth.refresh).toHaveBeenCalledOnce();
});
it.each([
  "missing",
  "refresh-error",
  "still-invalid",
  "different-user",
] as const)("fails closed for %s authentication", async (mode) => {
  const { auth } = authFixture(mode === "missing" ? null : undefined),
    expire = vi.fn();
  if (mode === "refresh-error")
    vi.mocked(auth.refresh).mockRejectedValue(
      new Error("Provider unavailable"),
    );
  if (mode === "different-user")
    vi.mocked(auth.refresh).mockResolvedValue({
      userId: "user-b",
      accessToken: "other-token",
    });
  const fetcher = vi.fn<typeof fetch>(async () => json("Unauthorized", 401));
  const client = createApi(
    "http://localhost:3001",
    auth,
    "user-a",
    expire,
    fetcher,
  );
  await expect(client.companies()).rejects.toMatchObject({ status: 401 });
  expect(expire).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledTimes(
    mode === "missing" ? 0 : mode === "still-invalid" ? 2 : 1,
  );
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain("other-token");
});
it.each([403, 404, 422, 500])(
  "does not refresh or retry status %s",
  async (status) => {
    const { auth } = authFixture(),
      expire = vi.fn();
    const fetcher = vi.fn<typeof fetch>(async () =>
      json("Request rejected", status),
    );
    const client = createApi(
      "http://localhost:3001",
      auth,
      "user-a",
      expire,
      fetcher,
    );
    await expect(client.createCompany("Example")).rejects.toMatchObject({
      status,
    });
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(expire).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  },
);
it("does not automatically replay a save after a network failure", async () => {
  const { auth } = authFixture();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("Network failed"));
  await expect(
    createApi(
      "http://localhost:3001",
      auth,
      "user-a",
      vi.fn(),
      fetcher,
    ).createCompany("Company"),
  ).rejects.toThrow("Network failed");
  expect(fetcher).toHaveBeenCalledOnce();
});
