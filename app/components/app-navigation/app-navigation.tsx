import { Link, useLocation } from "react-router";
import styles from "./app-navigation.module.css";

interface AppNavigationProps {
  onNavigate?: (path: string) => boolean;
}

export function AppNavigation({ onNavigate }: AppNavigationProps = {}) {
  const location = useLocation();

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    // If we're on the admin page and there's a navigation handler
    if (onNavigate && location.pathname === "/admin") {
      // Let the handler decide whether to proceed
      const shouldProceed = onNavigate(path);
      if (!shouldProceed) {
        e.preventDefault();
      }
    }
  };

  return (
    <nav className={styles.navigation}>
      <Link 
        to="/" 
        className={styles.navLink}
        onClick={(e) => handleNavigation(e, "/")}
      >
        Home
      </Link>
      <Link 
        to="/help" 
        className={styles.navLink}
        onClick={(e) => handleNavigation(e, "/help")}
      >
        Help
      </Link>
      <Link 
        to="/admin" 
        className={styles.navLink}
        onClick={(e) => handleNavigation(e, "/admin")}
      >
        Admin
      </Link>
    </nav>
  );
}
