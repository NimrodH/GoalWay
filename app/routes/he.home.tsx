import { Link } from "react-router";
import type { Route } from "./+types/he.home";
import { missionsHe } from "~/data/missions-he";
import { BookOpen, Settings } from "lucide-react";
import styles from "./instructions.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "מרכז הבקרה - בחרו את המסלול שלכם" },
    {
      name: "description",
      content: "עיינו במשימות הזמינות ובחרו את מסלול הלמידה המתאים לצרכים שלכם.",
    },
  ];
}

export default function HeHome() {
  return (
    <div className={styles.menuContainer} dir="rtl">
      <div className={styles.menuContent}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <div>
            <h1 className={styles.menuTitle}>מרכז הבקרה</h1>
            <p className={styles.menuDescription}>
              ברוכים הבאים למרכז הבקרה. כל משימה מכילה סט מאורגן של הוראות שנועדו לעזור לכם לשלוט בהיבטים ספציפיים של הפלטפורמה. בחרו משימה למטה כדי להתחיל את מסע הלמידה שלכם. משימות יכולות לחלוק הוראות משותפות, ומאפשרות לכם לבנות ידע באופן הדרגתי.
            </p>
          </div>
          <Link
            to="/he/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-accent-4)",
              color: "var(--color-accent-11)",
              border: "1px solid var(--color-accent-7)",
              borderRadius: "var(--radius-2)",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: "0.875rem",
              transition: "background 0.2s",
            }}
          >
            <Settings size={16} />
            פאנל ניהול
          </Link>
        </div>

        <div className={styles.missionsGrid}>
          {missionsHe.map((mission) => (
            <Link key={mission.id} to={`/he/missions/${mission.id}`} className={styles.missionCard}>
              <div className={styles.missionHeader}>
                <BookOpen className={styles.missionIcon} />
                <h2 className={styles.missionTitle}>{mission.title}</h2>
              </div>
              <p className={styles.missionDescription}>{mission.description}</p>
              <div className={styles.missionFooter}>
                <span className={styles.instructionCount}>
                  {mission.instructionIds.length} {mission.instructionIds.length === 1 ? "הוראה" : "הוראות"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
