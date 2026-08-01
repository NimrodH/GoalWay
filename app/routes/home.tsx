import { Form, Link, redirect, useNavigate } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/home";
import { BookOpen, HelpCircle, LogIn, LogOut, Star, LayoutGrid, List, PencilRuler } from "lucide-react";
import styles from "./instructions.module.css";
import homeStyles from "./home.module.css";
import { getAllMissions, getExampleMissions, getMissionsForOrganization } from "~/services/missions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import { createServerSupabase } from "~/lib/supabase";
import { useState } from "react";
import LanguageSelect from "~/components/language-select/language-select";
import { getMissionOrganizations, getOrganizations } from "~/services/organizations.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Mission Control - Choose Your Path" },
    {
      name: "description",
      content: "Browse available missions and choose the learning path that fits your needs.",
    },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createServerSupabase(request);
  await supabase.auth.signOut();
  return redirect("/", { headers });
}

export async function loader({ request }: Route.LoaderArgs) {
  const profile = await getUserProfile(request);

  // Admin sees ALL missions
  if (profile && isAdmin(profile)) {
    const allMissions = await getAllMissions();
    const filtered = allMissions.filter((m) => m.status !== "Hide");
    const organizations = await getOrganizations();
    const missionsWithAccess = await Promise.all(
      filtered.map(async (mission) => ({
        ...mission,
        allowedOrgIds: mission.isTemp ? [] : await getMissionOrganizations(mission.id),
      })),
    );

    return {
      missions: filtered,
      missionsWithAccess,
      organizations,
      isAdmin: true,
      isAnonymous: false,
      isPending: false,
      profile,
    };
  }

  // Always fetch example missions — visible to everyone
  const exampleMissions = await getExampleMissions();
  const visibleExamples = exampleMissions.filter((m) => m.status !== "Hide");

  if (!profile) {
    // Not logged in — only examples
    return { missions: visibleExamples, isAnonymous: true, isPending: false, isAdmin: false, profile: null };
  }

  if (!profile.organization_id) {
    // Logged in but not assigned to an org yet (pending approval)
    return { missions: visibleExamples, isAnonymous: false, isPending: true, isAdmin: false, profile };
  }

  // Authenticated + assigned → org missions merged with examples
  const orgMissions = await getMissionsForOrganization(profile.organization_id);
  const visibleOrgMissions = orgMissions.filter((m) => m.status !== "Hide");

  // Deduplicate: org missions + example missions (examples may already appear in org list)
  const missionIds = new Set(visibleOrgMissions.map((m) => m.id));
  const merged = [...visibleOrgMissions, ...visibleExamples.filter((m) => !missionIds.has(m.id))];

  return { missions: merged, isAnonymous: false, isPending: false, isAdmin: false, profile };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { missions, missionsWithAccess, organizations, isAnonymous, isPending, isAdmin: adminView, profile } =
    loaderData;
  const navigate = useNavigate();
  const [missionFilter, setMissionFilter] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const missionList = adminView ? missionsWithAccess : missions;

  const filteredMissions = missionList.filter((mission) => {
    if (adminView && organizationFilter && !("allowedOrgIds" in mission && mission.allowedOrgIds.includes(organizationFilter))) {
      return false;
    }
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
            if (e.shiftKey) navigate("/admin");
          }}
        >
          <h1 className={styles.menuTitle}>GoalWay - how to do a mission_</h1>
          <p className={styles.menuDescription}>
            Clicking on a mission will open a sequence of instructions on what to do. Clicking on an instruction will
            open an explanation with screenshots of how to perform it. A green row is a condition — click on it to get
            instructions that should only be followed if the condition is true.
          </p>
        </div>

        {/* Status banner for anonymous or pending users */}
        {(isAnonymous || isPending) && (
          <div className={homeStyles.banner}>
            {isAnonymous ? (
              <>
                <span>You&apos;re viewing part of the missions.</span>
                <Link to="/login" className={homeStyles.bannerLink}>
                  <LogIn size={14} />
                  Sign In
                </Link>
                <span>or</span>
                <Link to="/register" className={homeStyles.bannerLink}>
                  Register
                </Link>
                <span>to see all missions for your organization.</span>
              </>
            ) : (
              <span>
                Your account is <strong>pending approval</strong>. An administrator will assign your organization
                shortly. Example missions are available in the meantime.
              </span>
            )}
          </div>
        )}

        {/* Signed-in user info bar */}
        {!isAnonymous && profile && (
          <div className={homeStyles.userBar}>
            <span className={homeStyles.userEmail}>{profile.email}</span>
            <Form method="post">
              <button type="submit" className={homeStyles.signOutButton}>
                <LogOut size={14} />
                Sign Out
              </button>
            </Form>
          </div>
        )}

        {/* Admin badge */}
        {adminView && <div className={homeStyles.adminBanner}>👑 Admin view — showing all missions</div>}

        <div style={{ marginBottom: "var(--space-4)", display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          {adminView && (
            <Link
              to="/admin/missions"
              style={{
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--color-neutral-6)",
                borderRadius: "var(--radius-2)",
                fontSize: "0.875rem",
                backgroundColor: "var(--color-neutral-3)",
                color: "var(--color-neutral-11)",
                cursor: "pointer",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-neutral-4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-neutral-3)";
              }}
            >
              <PencilRuler size={16} />
              Editor
            </Link>
          )}
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
          <LanguageSelect currentLang="en" />
            {adminView && (
              <select
                value={organizationFilter}
                onChange={(e) => setOrganizationFilter(e.target.value)}
                style={{
                  minWidth: "220px",
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-neutral-6)",
                  borderRadius: "var(--radius-2)",
                  fontSize: "0.875rem",
                  backgroundColor: "var(--color-neutral-2)",
                  color: "var(--color-neutral-12)",
                }}
              >
                <option value="">All organizations</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            )}
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
            onClick={() => {
              setMissionFilter("");
              setOrganizationFilter("");
            }}
            disabled={!missionFilter.trim() && !organizationFilter}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-neutral-6)",
              borderRadius: "var(--radius-2)",
              fontSize: "0.875rem",
              backgroundColor: "var(--color-neutral-3)",
              color: "var(--color-neutral-12)",
              cursor: missionFilter.trim() || organizationFilter ? "pointer" : "not-allowed",
              opacity: missionFilter.trim() || organizationFilter ? 1 : 0.5,
            }}
          >
            Clear
          </button>
          <div className={homeStyles.viewToggle}>
            <button
              className={`${homeStyles.viewToggleButton} ${viewMode === "cards" ? homeStyles.viewToggleActive : ""}`}
              onClick={() => setViewMode("cards")}
              title="Card view"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              className={`${homeStyles.viewToggleButton} ${viewMode === "list" ? homeStyles.viewToggleActive : ""}`}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <div className={viewMode === "list" ? homeStyles.missionsList : styles.missionsGrid}>
          {filteredMissions.map((mission) => (
            <Link
              key={mission.id}
              to={`/missions/${mission.id}`}
              className={viewMode === "list" ? homeStyles.missionListItem : styles.missionCard}
            >
              <div className={styles.missionHeader}>
                <BookOpen className={styles.missionIcon} />
                <div className={styles.missionTitle}>
                  <Markdown
                    remarkPlugins={[remarkBreaks]}
                    components={{
                      p: ({ children }) => <span>{children}</span>,
                      a: ({ children }) => <span>{children}</span>,
                    }}
                  >
                    {mission.title}
                  </Markdown>
                </div>
              </div>
              {viewMode === "cards" && (
                <div className={styles.missionDescription}>
                  <Markdown
                    remarkPlugins={[remarkBreaks]}
                    components={{ a: ({ children }) => <span>{children}</span> }}
                  >
                    {mission.description}
                  </Markdown>
                </div>
              )}
              <div className={styles.missionFooter}>
                <span className={styles.instructionCount}>
                  {mission.instructions.length} {mission.instructions.length === 1 ? "instruction" : "instructions"}
                </span>
                {mission.isExample && (
                  <span className={homeStyles.exampleBadge}>
                    <Star size={10} />
                    Example
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
