import { Form, Link, data, redirect, useNavigate } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/he.home";
import { BookOpen, HelpCircle, LogIn, LogOut, Star, LayoutGrid, List, PencilRuler } from "lucide-react";
import styles from "./instructions.module.css";
import homeStyles from "./home.module.css";
import { getAllMissionsHe, getExampleMissionsHe, getMissionsForOrganizationHe } from "~/services/missions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import { createServerSupabase } from "~/lib/supabase";
import { useState } from "react";
import LanguageSelect from "~/components/language-select/language-select";
import { getOrganizationByNameOrSlug, getOrganizationMissionIds, type Organization } from "~/services/organizations.server";
import { buildOrgFilterCookie, getOrgFilterFromCookie } from "~/lib/org-filter.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "מרכז הבקרה - בחרו את המסלול שלכם" },
    {
      name: "description",
      content: "עיינו במשימות הזמינות ובחרו את מסלול הלמידה המתאים לצרכים שלכם.",
    },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createServerSupabase(request);
  await supabase.auth.signOut();
  return redirect("/he", { headers });
}

export async function loader({ request }: Route.LoaderArgs) {
  const profile = await getUserProfile(request);

  const url = new URL(request.url);
  const orgParam = url.searchParams.get("org");
  const effectiveOrgParam = orgParam ?? getOrgFilterFromCookie(request);
  const headers = new Headers();
  if (orgParam !== null) {
    headers.append("Set-Cookie", buildOrgFilterCookie(orgParam));
  }

  // Admin sees ALL Hebrew missions — the org filter only applies to anonymous visitors
  if (profile && isAdmin(profile)) {
    const allMissions = await getAllMissionsHe();
    const filtered = allMissions;
    return data(
      { missions: filtered, isAdmin: true, isAnonymous: false, isPending: false, profile, filterOrganization: null as Organization | null },
      { headers },
    );
  }

  // Always fetch Hebrew example missions — visible to everyone
  const exampleMissions = await getExampleMissionsHe();
  const visibleExamples = exampleMissions;

  if (!profile) {
    // Not logged in — only examples, scoped to the requested/remembered organization (if any)
    let anonymousExamples = visibleExamples;
    let filterOrganization: Organization | null = null;
    if (effectiveOrgParam) {
      filterOrganization = await getOrganizationByNameOrSlug(effectiveOrgParam);
      const orgMissionIds = new Set(filterOrganization ? await getOrganizationMissionIds(filterOrganization.id) : []);
      anonymousExamples = visibleExamples.filter((m) => orgMissionIds.has(m.id));
    }
    return data(
      { missions: anonymousExamples, isAnonymous: true, isPending: false, isAdmin: false, profile: null, filterOrganization },
      { headers },
    );
  }

  if (!profile.organization_id) {
    // Logged in but not assigned to an org yet (pending approval)
    return data(
      { missions: visibleExamples, isAnonymous: false, isPending: true, isAdmin: false, profile, filterOrganization: null },
      { headers },
    );
  }

  // Authenticated + assigned → org missions merged with examples
  const orgMissions = await getMissionsForOrganizationHe(profile.organization_id);
  const visibleOrgMissions = orgMissions;

  // Deduplicate: org missions + example missions
  const missionIds = new Set(visibleOrgMissions.map((m) => m.id));
  const merged = [...visibleOrgMissions, ...visibleExamples.filter((m) => !missionIds.has(m.id))];

  return data(
    { missions: merged, isAnonymous: false, isPending: false, isAdmin: false, profile, filterOrganization: null },
    { headers },
  );
}

export default function HeHome({ loaderData }: Route.ComponentProps) {
  const { missions, isAnonymous, isPending, isAdmin: adminView, profile, filterOrganization } = loaderData;
  const navigate = useNavigate();
  const [missionFilter, setMissionFilter] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const filteredMissions = missions.filter((mission) => {
    if (!missionFilter.trim()) return true;
    const searchTerm = missionFilter.toLowerCase().trim();
    const title = mission.title?.toLowerCase() || "";
    const description = mission.description?.toLowerCase() || "";
    return title.includes(searchTerm) || description.includes(searchTerm);
  });

  return (
    <div className={styles.menuContainer} dir="rtl">
      <div className={styles.menuContent}>
        <div
          style={{ marginBottom: "var(--space-1)" }}
          onClick={(e) => {
            if (e.shiftKey) navigate("/admin");
          }}
        >
          <h1 className={styles.menuTitle}>משימות והנחיות - כיצד לבצע משימה</h1>
          <p className={styles.menuDescription}>
            הקלדה על משימה תפתח רצף הנחיות מה לבצע. הקלקה על הנחייה תפתח הסבר עם צילומי מסך כיצד לבצע. שורה ירוקה היא
            תנאי - יש ללחוץ עליו לקבלת הנחיות שיש לבצע רק אם התנאי נכון
          </p>
        </div>

        {/* Status banner for anonymous or pending users */}
        {(isAnonymous || isPending) && (
          <div className={homeStyles.banner}>
            {isAnonymous ? (
              <>
                <span>
                  אתם צופים בחלק מהמשימות
                  {filterOrganization ? (
                    <>
                      {" "}של <strong>{filterOrganization.name}</strong>
                    </>
                  ) : null}
                  .
                </span>
                <Link to="/login" className={homeStyles.bannerLink}>
                  <LogIn size={14} />
                  התחברות
                </Link>
                <span>או</span>
                <Link to="/register" className={homeStyles.bannerLink}>
                  הרשמה
                </Link>
                <span>כדי לראות את כל המשימות של הארגון שלכם.</span>
              </>
            ) : (
              <span>
                חשבונכם <strong>ממתין לאישור</strong>. מנהל המערכת יקצה את הארגון שלכם בקרוב. בינתיים, משימות לדוגמה
                זמינות לצפייה.
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
                התנתקות
              </button>
            </Form>
          </div>
        )}

        {/* Admin badge */}
        {adminView && <div className={homeStyles.adminBanner}>👑 תצוגת מנהל — מציג את כל המשימות</div>}

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
              עורך
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
            עזרה
          </Link>
          <LanguageSelect currentLang="he" />
          <input
            type="text"
            value={missionFilter}
            onChange={(e) => setMissionFilter(e.target.value)}
            placeholder="סינון לפי כותרת או תיאור..."
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
            נקה
          </button>
          <div className={homeStyles.viewToggle}>
            <button
              className={`${homeStyles.viewToggleButton} ${viewMode === "cards" ? homeStyles.viewToggleActive : ""}`}
              onClick={() => setViewMode("cards")}
              title="תצוגת כרטיסים"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              className={`${homeStyles.viewToggleButton} ${viewMode === "list" ? homeStyles.viewToggleActive : ""}`}
              onClick={() => setViewMode("list")}
              title="תצוגת רשימה"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <div className={viewMode === "list" ? homeStyles.missionsList : styles.missionsGrid}>
          {filteredMissions.map((mission) => (
            <Link
              key={mission.id}
              to={`/he/missions/${mission.id}`}
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
                  <Markdown remarkPlugins={[remarkBreaks]} components={{ a: ({ children }) => <span>{children}</span> }}>
                    {mission.description}
                  </Markdown>
                </div>
              )}
              <div className={styles.missionFooter}>
                <span className={styles.instructionCount}>מזהה משימה: {mission.id}</span>
                <div className={styles.missionFooterStats}>
                  <span className={styles.instructionCount}>
                    {mission.instructions.length} {mission.instructions.length === 1 ? "הוראה" : "הוראות"}
                  </span>
                  {mission.isExample && (
                    <span className={homeStyles.exampleBadge}>
                      <Star size={10} />
                      דוגמה
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
