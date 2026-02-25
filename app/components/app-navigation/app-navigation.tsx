import { Link } from "react-router";
import styles from "./app-navigation.module.css";

export function AppNavigation() {
  return (
    <nav className={styles.navigation}>
      <Link to="/" className={styles.navLink}>
        Home
      </Link>
      <Link to="/admin?tab=edit-instruction" className={styles.navLink}>
        Admin - Instructions
      </Link>
      <Link to="/admin?tab=edit-mission" className={styles.navLink}>
        Admin - Missions
      </Link>
    </nav>
  );
}
