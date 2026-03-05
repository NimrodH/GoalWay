import { useState } from "react";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/login";
import { createServerSupabase } from "~/lib/supabase";
import styles from "./login.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign In - GoalWay" },
    { name: "description", content: "Sign in to access your organization's missions." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // If already logged in, redirect to home
  const { supabase } = createServerSupabase(request);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return redirect("/");
  return {};
}

/**
 * Server-side action: receives credentials, calls Supabase auth,
 * and returns a redirect with Set-Cookie headers so the session
 * is available to the server on the very next request.
 */
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { supabase, headers } = createServerSupabase(request);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Redirect to home — the Set-Cookie headers from supabase/ssr
  // carry the session so the loader on "/" sees the authenticated user.
  return redirect("/", { headers });
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const serverError = (actionData as { error?: string } | undefined)?.error;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to access your missions</p>
        </div>

        <form
          method="post"
          className={styles.form}
          onSubmit={() => setIsLoading(true)}
        >
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={styles.input}
              placeholder="your@email.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {serverError && <div className={styles.error}>{serverError}</div>}

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className={styles.footer}>
          Don&apos;t have an account?{" "}
          <Link to="/register" className={styles.link}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
