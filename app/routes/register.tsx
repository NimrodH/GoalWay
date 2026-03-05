import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/register";
import { getSupabase } from "~/lib/supabase";
import { getOrganizations } from "~/services/organizations.server";
import styles from "./login.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Register - GoalWay" },
    { name: "description", content: "Create an account to access your organization's missions." },
  ];
}

export async function loader() {
  const organizations = await getOrganizations();
  return { organizations };
}

export default function RegisterPage({ loaderData }: Route.ComponentProps) {
  const { organizations } = loaderData;
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setRegistered(true);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (registered) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.subtitle}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to verify your account, then sign in.
              An administrator will assign you to your organization.
            </p>
          </div>
          <p className={styles.footer}>
            <Link to="/login" className={styles.link}>
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Create an account</h1>
          <p className={styles.subtitle}>
            Register to request access to your organization&apos;s missions
          </p>
        </div>

        <form onSubmit={handleRegister} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="displayName" className={styles.label}>
              Full Name
            </label>
            <input
              id="displayName"
              type="text"
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              required
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Organization</label>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-neutral-10)" }}>
              {organizations.length > 0
                ? `Available: ${organizations.map((o) => o.name).join(", ")}. An admin will assign your organization after you register.`
                : "An administrator will assign your organization after registration."}
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{" "}
          <Link to="/login" className={styles.link}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
