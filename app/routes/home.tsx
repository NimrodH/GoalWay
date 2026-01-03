import { Link } from "react-router";
import type { Route } from "./+types/home";
import { missions } from "~/data/missions";
import { BookOpen, Settings } from "lucide-react";
import styles from "./instructions.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Mission Control - Choose Your Path" },
    {
      name: "description",
      content: "Browse available missions and choose the learning path that fits your needs.",
    },
  ];
}

export default function Home() {
  return (
    <div className={styles.menuContainer}>
      <div className={styles.menuContent}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <div>
            <h1 className={styles.menuTitle}>Mission Control</h1>
            <p className={styles.menuDescription}>
              Welcome to the Mission Control center. Each mission contains a curated set of instructions designed to help you master specific aspects of the platform. Choose a mission below to begin your learning journey. Missions can share common instructions, allowing you to build knowledge progressively.
            </p>
          </div>
          <Link
            to="/admin"
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
            Admin Panel
          </Link>
        </div>

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
      </div>
    </div>
  );
}
