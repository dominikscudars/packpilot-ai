import { expect, it } from "vitest";
import { frontendConfig } from "../auth/session";
it("allows offline demo without Supabase credentials", () => {
  expect(frontendConfig({}).supabase).toBeNull();
});
it("accepts only a public publishable key with exact origins", () => {
  expect(
    frontendConfig({
      VITE_API_URL: "https://api.example.test",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      PROD: true,
    }).supabase,
  ).not.toBeNull();
});
it.each([
  "sb_secret_do-not-expose",
  "eyJhbGciOiJIUzI1NiJ9.legacy.jwt",
  "",
  "service_role",
])("rejects unsupported or privileged key %s", (key) => {
  expect(() =>
    frontendConfig({
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    }),
  ).toThrow(/publishable/);
});
it.each([
  "http://public.example.test",
  "https://user:password@example.test",
  "https://api.example.test/path",
  "https://api.example.test/",
  "javascript:alert(1)",
])("rejects unsafe API URL %s", (VITE_API_URL) => {
  expect(() => frontendConfig({ VITE_API_URL })).toThrow();
});
it("rejects HTTP localhost in production", () => {
  expect(() =>
    frontendConfig({ VITE_API_URL: "http://localhost:3001", PROD: true }),
  ).toThrow(/HTTPS/);
});
