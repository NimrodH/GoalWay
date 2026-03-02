import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { BookOpen, HelpCircle } from "lucide-react";
import styles from "./instructions.module.css";
import { getAllMissions } from "~/services/missions.server";
import { useState } from "react";
import styles0 from "./home.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Mission Control - Choose Your Path" },
    {
      name: "description",
      content: "Browse available missions and choose the learning path that fits your needs.",
    },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const missions = await getAllMissions();
  return { missions };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { missions } = loaderData;
  const navigate = useNavigate();
  const [missionFilter, setMissionFilter] = useState("");

  const filteredMissions = missions.filter((mission) => {
    // Filter out missions with status "Hide"
    if (mission.status === "Hide") return false;

    // Apply search filter
    if (!missionFilter.trim()) return true;
    const searchTerm = missionFilter.toLowerCase().trim();
    const title = mission.title?.toLowerCase() || "";
    const description = mission.description?.toLowerCase() || "";
    return title.includes(searchTerm) || description.includes(searchTerm);
  });

  return (
    <div className={styles.menuContainer}>
      <div className={styles.menuContent}>
        <div
          style={{ marginBottom: "var(--space-1)" }}
          onClick={(e) => {
            if (e.shiftKey) {
              navigate("/admin");
            }
          }}
        >
          <h1 className={styles.menuTitle}>GoalWay - how to do a mission</h1>
          <p className={styles.menuDescription}> Please read the HELP page !</p>
        </div>

        <div style={{ marginBottom: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
          <input
            type="text"
            value={missionFilter}
            onChange={(e) => setMissionFilter(e.target.value)}
            placeholder="Filter by title or description..."
            style={{
              flex: 1,
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-neutral-6)",
              borderRadius: "var(--radius-2)",
              fontSize: "0.875rem",
              backgroundColor: "var(--color-neutral-2)",
              color: "var(--color-neutral-12)",
            }}
          />
          <button
            type="button"
            onClick={() => setMissionFilter("")}
            disabled={!missionFilter.trim()}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-neutral-6)",
              borderRadius: "var(--radius-2)",
              fontSize: "0.875rem",
              backgroundColor: "var(--color-neutral-3)",
              color: "var(--color-neutral-12)",
              cursor: missionFilter.trim() ? "pointer" : "not-allowed",
              opacity: missionFilter.trim() ? 1 : 0.5,
            }}
          >
            Clear
          </button>
          <Link
            to="/help"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-accent-6)",
              borderRadius: "var(--radius-2)",
              fontSize: "0.875rem",
              backgroundColor: "var(--color-accent-3)",
              color: "var(--color-accent-11)",
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-accent-4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-accent-3)";
            }}
          >
            <HelpCircle size={16} />
            Help
          </Link>
        </div>

        <div className={styles.missionsGrid}>
          {filteredMissions.map((mission) => (
            <Link key={mission.id} to={`/missions/${mission.id}`} className={styles.missionCard}>
              <div className={styles.missionHeader}>
                <BookOpen className={styles.missionIcon} />
                <h2 className={styles.missionTitle}>{mission.title}</h2>
              </div>
              <p className={styles.missionDescription}>{mission.description}</p>
              <div className={styles.missionFooter}>
                <span className={styles.instructionCount}>
                  {mission.instructions.length} {mission.instructions.length === 1 ? "instruction" : "instructions"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
