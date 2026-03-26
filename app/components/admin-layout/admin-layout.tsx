import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/hooks/use-auth";
import { initSupabase } from "~/lib/supabase";
import { AppNavigation } from "~/components/app-navigation/app-navigation";
import styles from "~/routes/admin.module.css";

export type AdminSection = "instructions" | "missions" | "users";

type AdminLayoutLoaderData = {
  supabaseUrl: string;
  supabaseKey: string;
  language: string;
  users: Array<{ organization_id: string | null; role: string }>;
};

type AdminLayoutRenderProps = {
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
  clearActionData: () => void;
  sessionAccessToken: string | null;
};

const SECTION_PATHS: Record<AdminSection, string> = {
  instructions: "/admin/instructions",
  missions: "/admin/missions",
  users: "/admin/users",
};

export function AdminLayout<TLoaderData extends AdminLayoutLoaderData>({
  loaderData,
  activeSection,
  children,
}: {
  loaderData: TLoaderData;
  activeSection: AdminSection;
  children: (props: AdminLayoutRenderProps) => React.ReactNode;
}) {
  const navigate = useNavigate();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const currentPath = SECTION_PATHS[activeSection];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();

        const primarySaveButton = document.querySelector('[data-admin-primary-save="true"]') as HTMLButtonElement | null;
        const fallbackSubmitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        const saveButton = primarySaveButton ?? fallbackSubmitButton;

        if (saveButton && !saveButton.disabled) {
          saveButton.click();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  initSupabase(loaderData.supabaseUrl, loaderData.supabaseKey);

  const { user, session, loading, signIn, signOut } = useAuth();

  const onNavigationRequest = (navigationFn: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => navigationFn);
    } else {
      navigationFn();
    }
  };

  const handleMenuNavigation = (path: string): boolean => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => () => {
        window.location.href = path;
      });
      return false;
    }
    return true;
  };

  const saveAndNavigate = () => {
    const primarySaveButton = document.querySelector('[data-admin-primary-save="true"]') as HTMLButtonElement | null;
    const fallbackSubmitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    const saveButton = primarySaveButton ?? fallbackSubmitButton;

    if (saveButton && !saveButton.disabled) {
      saveButton.click();
    }

    setTimeout(() => {
      setHasUnsavedChanges(false);
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
    }, 150);
  };

  const confirmDiscardChanges = () => {
    setHasUnsavedChanges(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const cancelNavigation = () => {
    setPendingNavigation(null);
  };

  const clearActionData = () => {
    navigate(`${currentPath}?lang=${loaderData.language}`, { replace: true });
  };

  const switchLanguage = (newLang: string) => {
    navigate(`${currentPath}?lang=${newLang}`);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSigningIn(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    }

    setIsSigningIn(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loginContainer}>
          <div className={styles.loginCard}>
            <h1 className={styles.loginTitle}>Admin Login</h1>
            <p className={styles.loginSubtitle}>Sign in to access the admin panel</p>

            <form onSubmit={handleSignIn} className={styles.loginForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
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
                <label className={styles.label}>Password</label>
                <input
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && <div className={styles.errorMessage}>{error}</div>}

              <button type="submit" className={styles.submitButton} disabled={isSigningIn}>
                {isSigningIn ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <AppNavigation
        onNavigate={handleMenuNavigation}
        adminTab={activeSection}
        pendingUsersCount={loaderData.users.filter((u) => !u.organization_id && u.role !== "admin").length}
      />

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>Developer Admin Panel</h1>
            <p className={styles.subtitle}>Create and manage instructions and missions</p>
          </div>
          <div className={styles.userInfo}>
            <button
              onClick={() => onNavigationRequest(() => navigate("/"))}
              className={styles.homeButton}
              style={{ cursor: "pointer" }}
            >
              Go to Home
            </button>
            <div className={styles.languageToggle}>
              <button
                type="button"
                onClick={() => switchLanguage("en")}
                className={loaderData.language === "en" ? styles.languageActive : styles.languageInactive}
              >
                English
              </button>
              <span className={styles.languageSeparator}>|</span>
              <button
                type="button"
                onClick={() => switchLanguage("he")}
                className={loaderData.language === "he" ? styles.languageActive : styles.languageInactive}
              >
                Hebrew
              </button>
            </div>
            {user.email}
            <span className={styles.userEmail}></span>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {children({
        onChangesDetected: setHasUnsavedChanges,
        onNavigationRequest,
        clearActionData,
        sessionAccessToken: session?.access_token ?? null,
      })}

      {pendingNavigation && (
        <div className={styles.dialogOverlay}>
          <div className={styles.warningDialog}>
            <div className={styles.warningDialogHeader}>
              <h2 className={styles.warningDialogTitle}>Unsaved Changes</h2>
            </div>
            <p className={styles.warningDialogText}>
              You have unsaved changes. Do you want to save them before leaving?
            </p>
            <div className={styles.warningDialogButtons}>
              <button className={styles.addButton} onClick={cancelNavigation}>
                Cancel
              </button>
              <button className={styles.submitButton} onClick={saveAndNavigate}>
                Save
              </button>
              <button className={styles.removeButton} onClick={confirmDiscardChanges}>
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
