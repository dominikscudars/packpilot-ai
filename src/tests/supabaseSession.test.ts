import { expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAuth } from "../auth/session";
it("uses the Supabase SDK for sign-in, session events, refresh and local sign-out with mocked HTTP", async () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = (sequence: number) =>
    `${btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: userId, exp: expiresAt, sequence }))}.test-signature`;
  let sequence = 0;
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    if (String(url).includes("/logout"))
      return new Response("{}", { status: 200 });
    sequence++;
    return new Response(
      JSON.stringify({
        access_token: token(sequence),
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "synthetic-refresh",
        user: {
          id: userId,
          aud: "authenticated",
          email: "pilot@example.test",
          created_at: "2026-01-01T00:00:00Z",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  const client = createClient(
    "https://fixture.supabase.co",
    "sb_publishable_fixture",
    {
      global: { fetch: fetcher },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const auth = supabaseAuth(client),
    listener = vi.fn();
  const unsubscribe = auth.subscribe(listener);
  expect(await auth.current()).toBeNull();
  await auth.signIn("pilot@example.test", "synthetic-password");
  expect((await auth.current())?.userId).toBe(userId);
  expect(listener).toHaveBeenCalledWith({ userId, accessToken: token(1) });
  const refreshed = await auth.refresh();
  expect(refreshed?.accessToken).toBe(token(2));
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).includes("grant_type=refresh_token"),
    ),
  ).toBe(true);
  await auth.signOut();
  expect(await auth.current()).toBeNull();
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).includes("/logout?scope=local"),
    ),
  ).toBe(true);
  unsubscribe();
});
