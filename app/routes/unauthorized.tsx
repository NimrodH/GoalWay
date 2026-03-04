import { Link } from "react-router";
import type { Route } from "./+types/unauthorized";
import { Lock } from "lucide-react";
import styles from "./unauthorized.module.css";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Access Denied - GoalWay" }];
}

export default function UnauthorizedPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <Lock size={40} />
        </div>
        <h1 className={styles.title}>Access Denied</h1>
        <p className={styles.description}>
          This mission is not available for your organization. Please contact your administrator if
          you think this is a mistake.
        </p>
        <Link to="/" className={styles.backButton}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
