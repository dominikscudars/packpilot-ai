import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
export interface Identity {
  userId: string;
  accessToken: string;
}
export interface SignUpProfile {
  name: string;
  company: string;
}
export interface AuthPort {
  current(): Promise<Identity | null>;
  refresh(): Promise<Identity | null>;
  subscribe(listener: (identity: Identity | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** Creates an account; absent when sign-up is not available. */
  signUp?(
    email: string,
    password: string,
    profile: SignUpProfile,
  ): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}
const identity = (session: Session | null): Identity | null =>
  session
    ? { userId: session.user.id, accessToken: session.access_token }
    : null;
export function supabaseAuth(client: SupabaseClient): AuthPort {
  return {
    async current() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return identity(data.session);
    },
    async refresh() {
      const { data, error } = await client.auth.refreshSession();
      if (error) throw error;
      return identity(data.session);
    },
    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(identity(session)),
      );
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    async signUp(email, password, profile) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: profile.name, company_name: profile.company },
          emailRedirectTo:
            typeof window === "undefined" ? undefined : window.location.origin,
        },
      });
      if (error) throw error;
      // Supabase hides whether an address is already registered: an existing
      // user comes back with no identities and no session.
      if (data.user && data.user.identities?.length === 0)
        throw new Error(
          "An account with this email may already exist. Try logging in.",
        );
      return { needsConfirmation: !data.session };
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    },
  };
}
export function frontendConfig(
  env: Record<string, string | boolean | undefined>,
) {
  const apiUrl = String(env.VITE_API_URL || "http://localhost:3001");
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  function origin(value: string, name: string) {
    const parsed = new URL(value);
    if (
      parsed.origin !== value ||
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== "https:" &&
        !(
          parsed.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
        ))
    )
      throw new Error(
        `${name} must be an HTTPS origin (or loopback HTTP in development).`,
      );
    if (env.PROD && parsed.protocol !== "https:")
      throw new Error(`${name} must use HTTPS in production.`);
    return value;
  }
  if (!url && !key && !env.VITE_API_URL) return { apiUrl, supabase: null };
  origin(apiUrl, "VITE_API_URL");
  if (!url && !key) return { apiUrl, supabase: null };
  if (
    typeof url !== "string" ||
    typeof key !== "string" ||
    !key.startsWith("sb_publishable_")
  )
    throw new Error(
      "Configure a Supabase URL and sb_publishable_ client key. Secret and legacy JWT keys are not accepted.",
    );
  return { apiUrl, supabase: { url: origin(url, "VITE_SUPABASE_URL"), key } };
}
export function configuredAuth(): {
  auth: AuthPort | null;
  apiUrl: string;
  error: string | null;
} {
  try {
    const config = frontendConfig(import.meta.env);
    return {
      apiUrl: config.apiUrl,
      auth: config.supabase
        ? supabaseAuth(createClient(config.supabase.url, config.supabase.key))
        : null,
      error: null,
    };
  } catch (error) {
    return {
      apiUrl: "",
      auth: null,
      error:
        error instanceof Error
          ? error.message
          : "Invalid frontend configuration.",
    };
  }
}
