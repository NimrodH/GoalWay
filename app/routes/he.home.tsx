import { Link } from "react-router";
import type { Route } from "./+types/he.home";
import { BookOpen } from "lucide-react";
import styles from "./instructions.module.css";
import { getAllMissionsHe } from "~/services/missions.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "מרכז הבקרה - בחרו את המסלול שלכם" },
    {
      name: "description",
      content: "עיינו במשימות הזמינות ובחרו את מסלול הלמידה המתאים לצרכים שלכם.",
    },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const missionsHe = await getAllMissionsHe();
  return { missionsHe };
}

export default function HeHome({ loaderData }: Route.ComponentProps) {
  const { missionsHe } = loaderData;
  
  // Filter out missions with status "Hide"
  const visibleMissions = missionsHe.filter(mission => mission.status !== "Hide");
  
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

        </div>

        <div className={styles.missionsGrid}>
          {visibleMissions.map((mission) => (
            <Link key={mission.id} to={`/he/missions/${mission.id}`} className={styles.missionCard}>
              <div className={styles.missionHeader}>
                <BookOpen className={styles.missionIcon} />
                <h2 className={styles.missionTitle}>{mission.title}</h2>
              </div>
              <p className={styles.missionDescription}>{mission.description}</p>
              <div className={styles.missionFooter}>
                <span className={styles.instructionCount}>
                  {mission.instructions.length} {mission.instructions.length === 1 ? "הוראה" : "הוראות"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
