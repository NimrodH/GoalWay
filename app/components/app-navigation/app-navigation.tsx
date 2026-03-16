import { NavLink, useLocation } from "react-router";
import styles from "./app-navigation.module.css";

interface AppNavigationProps {
  onNavigate?: (path: string) => boolean;
  adminTab?: string;
  pendingUsersCount?: number;
}

const ADMIN_TABS = [
  { value: "edit-instruction", label: "Instructions" },
  { value: "edit-mission", label: "Missions" },
  { value: "users", label: "Users" },
] as const;

export function AppNavigation({ onNavigate, adminTab, pendingUsersCount = 0 }: AppNavigationProps = {}) {
  const location = useLocation();
  const isOnAdmin = location.pathname === "/admin";

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
        to="/admin"
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
        onClick={(e) => handleNavigation(e, "/admin")}
      >
        Admin
      </NavLink>

      {isOnAdmin && (
        <div className={styles.adminTabLinks}>
          {ADMIN_TABS.map((tab) => {
            const path = `/admin?tab=${tab.value}`;
            const isActive = adminTab === tab.value;
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
