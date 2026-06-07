import { Form, Link, redirect } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/he.home";
import { BookOpen, LogIn, LogOut, Star } from "lucide-react";
import styles from "./instructions.module.css";
import homeStyles from "./home.module.css";
import { getAllMissionsHe, getExampleMissionsHe, getMissionsForOrganizationHe } from "~/services/missions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import { createServerSupabase } from "~/lib/supabase";
import LanguageSelect from "~/components/language-select/language-select";

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

  // Admin sees ALL Hebrew missions
  if (profile && isAdmin(profile)) {
    const allMissions = await getAllMissionsHe();
    const filtered = allMissions.filter((m) => m.status !== "Hide");
    return { missions: filtered, isAdmin: true, isAnonymous: false, isPending: false, profile };
  }

  // Always fetch Hebrew example missions — visible to everyone
  const exampleMissions = await getExampleMissionsHe();
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
  const orgMissions = await getMissionsForOrganizationHe(profile.organization_id);
  const visibleOrgMissions = orgMissions.filter((m) => m.status !== "Hide");

  // Deduplicate: org missions + example missions
  const missionIds = new Set(visibleOrgMissions.map((m) => m.id));
  const merged = [...visibleOrgMissions, ...visibleExamples.filter((m) => !missionIds.has(m.id))];

  return { missions: merged, isAnonymous: false, isPending: false, isAdmin: false, profile };
}

export default function HeHome({ loaderData }: Route.ComponentProps) {
  const { missions, isAnonymous, isPending, isAdmin: adminView, profile } = loaderData;

  return (
    <div className={styles.menuContainer} dir="rtl">
      <div className={styles.menuContent}>
        <div style={{ marginBottom: "var(--space-4)" }}>
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
                <span>אתם צופים בחלק מהמשימות.</span>
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

        <div style={{ marginBottom: "var(--space-4)", display: "flex", justifyContent: "flex-end" }}>
          <LanguageSelect currentLang="he" />
        </div>

        <div className={styles.missionsGrid}>
          {missions.map((mission) => (
            <Link key={mission.id} to={`/he/missions/${mission.id}`} className={styles.missionCard}>
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
              <div className={styles.missionDescription}>
                <Markdown remarkPlugins={[remarkBreaks]} components={{ a: ({ children }) => <span>{children}</span> }}>
                  {mission.description}
                </Markdown>
              </div>
              <div className={styles.missionFooter}>
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
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
