import { Link } from "react-router";
import styles from "./app-navigation.module.css";

export function AppNavigation() {
  return (
    <nav className={styles.navigation}>
      <Link to="/" className={styles.navLink}>
        Home
      </Link>
      <Link to="/admin" className={styles.navLink}>
        Admin
      </Link>
    </nav>
  );
}
