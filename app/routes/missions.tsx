import { Link } from "react-router";
import type { Route } from "./+types/missions";
import { missions } from "~/data/missions";
import { BookOpen } from "lucide-react";
import styles from "./instructions.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Missions - Choose Your Path" },
    {
      name: "description",
      content: "Browse available missions and choose the learning path that fits your needs.",
    },
  ];
}

export default function Missions() {
  return (
    <div className={styles.menuContainer}>
      <div className={styles.menuContent}>
        <h1 className={styles.menuTitle}>Mission Control</h1>
        <p className={styles.menuDescription}>
          Welcome to the Mission Control center. Each mission contains a curated set of instructions designed to help you master specific aspects of the platform. Choose a mission below to begin your learning journey. Missions can share common instructions, allowing you to build knowledge progressively.
        </p>

        <div className={styles.missionsGrid}>
          {missions.map((mission) => (
            <Link key={mission.id} to={`/missions/${mission.id}`} className={styles.missionCard}>
              <div className={styles.missionHeader}>
                <BookOpen className={styles.missionIcon} />
                <h2 className={styles.missionTitle}>{mission.title}</h2>
              </div>
              <p className={styles.missionDescription}>{mission.description}</p>
              <div className={styles.missionFooter}>
                <span className={styles.instructionCount}>
                  {mission.instructionIds.length} {mission.instructionIds.length === 1 ? "instruction" : "instructions"}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <Link to="/" className={styles.backLink}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
