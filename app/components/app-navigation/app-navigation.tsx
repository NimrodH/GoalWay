import { useState, useEffect } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router";
import styles from "./app-navigation.module.css";

interface AppNavigationProps {
  onNavigate?: (path: string) => boolean;
  adminTab?: string;
  pendingUsersCount?: number;
}

const ADMIN_PAGES = [
  { value: "instructions", legacyValue: "edit-instruction", label: "Instructions", path: "/admin/instructions" },
  { value: "missions", legacyValue: "edit-mission", label: "Missions", path: "/admin/missions" },
  { value: "users", legacyValue: "users", label: "Users", path: "/admin/users" },
] as const;

export function AppNavigation({ onNavigate, adminTab, pendingUsersCount = 0 }: AppNavigationProps = {}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isOnAdmin = location.pathname.startsWith("/admin");

  // Resolve the mission to preview:
  // - On missions screen: use the missionId URL param (most up-to-date)
  // - On instructions screen (or any admin page): fall back to localStorage
  const [lastMissionId, setLastMissionId] = useState<string | null>(null);

  useEffect(() => {
    const missionIdFromUrl = searchParams.get("missionId");
    if (missionIdFromUrl) {
      setLastMissionId(missionIdFromUrl);
    } else {
      setLastMissionId(localStorage.getItem("lastSelectedMissionId"));
    }
  }, [searchParams]);

  const previewMissionId = lastMissionId;

  const handlePreview = () => {
    if (!previewMissionId) return;
    const shouldProceed = onNavigate ? onNavigate(`/missions/${previewMissionId}?preview=true`) : true;
    if (shouldProceed) {
      window.open(`/missions/${previewMissionId}?preview=true`, "_blank");
    }
  };

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && isOnAdmin) {
      const shouldProceed = onNavigate(path);
      if (!shouldProceed) {
        e.preventDefault();
      }
    }
  };

  return (
    <nav className={styles.navigation}>
      <NavLink
        to="/"
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
        end
        onClick={(e) => handleNavigation(e, "/")}
      >
        Home
      </NavLink>
      <NavLink
        to="/help"
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
        onClick={(e) => handleNavigation(e, "/help")}
      >
        Help
      </NavLink>
      <NavLink
        to="/admin/instructions"
        className={() => `${styles.navLink} ${isOnAdmin ? styles.navLinkActive : ""}`}
        onClick={(e) => handleNavigation(e, "/admin/instructions")}
      >
        Admin
      </NavLink>

      {isOnAdmin && (
        <div className={styles.adminTabLinks}>
          {previewMissionId && (
            <button
              className={styles.previewButton}
              onClick={handlePreview}
              title={`Preview mission ${previewMissionId}`}
            >
              👁 Preview
            </button>
          )}
          {ADMIN_PAGES.map((tab) => {
            const path = tab.path;
            const isActive =
              adminTab === tab.value || adminTab === tab.legacyValue || location.pathname === tab.path;
            return (
              <a
                key={tab.value}
                href={path}
                className={`${styles.adminTabLink} ${isActive ? styles.adminTabLinkActive : ""}`}
                onClick={(e) => {
                  if (onNavigate) {
                    const shouldProceed = onNavigate(path);
                    if (!shouldProceed) e.preventDefault();
                  }
                }}
              >
                {tab.label}
                {tab.value === "users" && pendingUsersCount > 0 && (
                  <span className={styles.badge}>{pendingUsersCount}</span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}
