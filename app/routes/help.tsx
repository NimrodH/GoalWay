import { Link } from "react-router";
import type { Route } from "./+types/help";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Folder,
  GitBranch,
  Image as ImageIcon,
  Link as LinkIcon,
  MessageSquare,
  Pencil,
  Search,
  Tag,
  Video,
  StickyNote,
  Repeat2,
  Layers,
  Globe,
  CircleDot,
} from "lucide-react";
import styles from "./help.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Help - Mission Control Center" },
    {
      name: "description",
      content: "Learn how to use the Mission Control Center effectively.",
    },
  ];
}

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeVariant?: "admin" | "user" | "both";
  description: string;
  usage: string[];
}

const USER_FEATURES: FeatureItem[] = [
  {
    icon: <Search size={20} />,
    title: "Mission Search & Filter",
    badgeVariant: "user",
    description: "Quickly find the mission you need by searching through all available missions.",
    usage: [
      "Type any keyword in the search box on the home page to filter missions in real time.",
      "The search matches both mission titles and descriptions.",
      "Clear the search to see all available missions again.",
    ],
  },
  {
    icon: <Folder size={20} />,
    title: "Missions",
    badgeVariant: "user",
    description:
      "Missions are step-by-step guides that group related instructions together for a specific task or workflow.",
    usage: [
      "Click any mission card on the home page to open it.",
      "Each mission shows a numbered list of instructions to follow in order.",
      "Your progress (which instructions you've opened) is tracked during the session.",
      "The instruction number badge turns green when you've viewed that step.",
    ],
  },
  {
    icon: <ChevronDown size={20} />,
    title: "Click-to-Expand Instructions",
    badgeVariant: "user",
    description: "Each instruction in a mission can be expanded to reveal its full explanation, images, and videos.",
    usage: [
      "Click any instruction title to expand it and see the full explanation.",
      "Click again (or click the next instruction) to collapse it.",
      "Instructions may contain text, screenshots, or video content depending on how they were authored.",
    ],
  },
  {
    icon: <ImageIcon size={20} />,
    title: "Annotated Images",
    badgeVariant: "user",
    description:
      "Screenshots inside instructions may include numbered annotation boxes that highlight specific areas of the image.",
    usage: [
      "Colored numbered boxes are drawn over important areas of the image.",
      "Red boxes indicate Click-here actions.",
      "Orange boxes indicate Double-click actions.",
      "Blue boxes indicate where to type or write.",
      "Green boxes indicate optional steps.",
      "Gray boxes are redaction overlays that hide sensitive information.",
      "If an annotation has a description, it appears below the image as a numbered list.",
    ],
  },
  {
    icon: <LinkIcon size={20} />,
    title: "Link Instructions",
    badgeVariant: "user",
    description:
      "Some instructions are actually links that navigate you to a different mission when clicked.",
    usage: [
      "Instructions marked as Link type will open a different mission when expanded.",
      "This is used to redirect you to prerequisite or related workflows without duplicating content.",
    ],
  },
  {
    icon: <MessageSquare size={20} />,
    title: "Comments in Mission Lists",
    badgeVariant: "user",
    description:
      "Mission instruction lists may contain comment lines that are informational notes, not clickable instructions.",
    usage: [
      "Comment lines appear inline within the instruction list, styled differently from real instructions.",
      "They are purely informational and do not expand when clicked.",
    ],
  },
  {
    icon: <GitBranch size={20} />,
    title: "IF / END-IF Conditional Blocks",
    badgeVariant: "user",
    description:
      "Missions can include conditional branching markers (IF and END-IF) that indicate steps only relevant in certain scenarios.",
    usage: [
      "IF markers appear highlighted in green and describe a condition, e.g. IF using version 2.",
      "END-IF markers indicate the end of the conditional block.",
      "Only follow the steps inside the IF block if the condition applies to your situation.",
    ],
  },
  {
    icon: <Globe size={20} />,
    title: "Language Support (Hebrew / English)",
    badgeVariant: "user",
    description: "The platform supports both English and Hebrew content. Some missions are available in both languages.",
    usage: [
      "The home page defaults to English.",
      "Hebrew missions are available at the /he/home route.",
      "Each instruction can have separate content per language, independently authored.",
    ],
  },
];

const ADMIN_FEATURES: FeatureItem[] = [
  {
    icon: <BookOpen size={20} />,
    title: "Instruction Authoring",
    badge: "Admin: Instructions",
    badgeVariant: "admin",
    description:
      "Create and edit the reusable instruction content blocks. Each instruction is stored independently and can be reused across multiple missions.",
    usage: [
      "Select an existing instruction from the left panel to load it into the editor.",
      "Filter the instruction list by ID or title using the search box.",
      "Each instruction has a Title, an optional Description, a Type (Standard or Link), and a Status.",
      "Status: Only Title (red) = no explanation; Partial Explanation = in progress; Full Explanation (green) = complete.",
      "Add content blocks: Text, Image, or Video. Reorder blocks using up/down arrows.",
      "Save to Database separately for English and Hebrew using the language toggle.",
    ],
  },
  {
    icon: <FileText size={20} />,
    title: "Text Content Blocks",
    badge: "Admin: Instructions",
    badgeVariant: "admin",
    description: "Free-form text explanations authored per instruction. Supports plain text narrative.",
    usage: [
      "Click + Add Text inside the instruction editor to add a text block.",
      "Type or paste your explanation text into the textarea.",
      "Multiple text blocks can be interspersed with images and videos.",
    ],
  },
  {
    icon: <ImageIcon size={20} />,
    title: "Image Content Blocks & Upload",
    badge: "Admin: Instructions",
    badgeVariant: "admin",
    description:
      "Attach screenshots or images to instructions. Images are stored in Supabase Storage and referenced by URL.",
    usage: [
      "Click + Add Image to add an image block.",
      "Paste an image URL directly, OR upload a file from disk, OR paste from clipboard (Ctrl+V).",
      "Use Select from Library to pick an existing image from the Supabase storage.",
      "Give the image a descriptive filename before uploading — it becomes the permanent storage key.",
      "After uploading, the image URL is auto-filled and the preview is shown.",
    ],
  },
  {
    icon: <Layers size={20} />,
    title: "Image Annotations",
    badge: "Admin: Instructions",
    badgeVariant: "admin",
    description:
      "Draw numbered rectangles over images to highlight specific UI areas. Each annotation can carry a color, badge position, and a text description.",
    usage: [
      "Click Annotate (N) on an image block to open the annotation editor.",
      "Switch between Annotate mode (draw boxes) and Redact mode (cover sensitive areas).",
      "Draw rectangles by clicking and dragging on the image.",
      "Color meanings: Red = Click, Orange = Double-click, Blue = Write, Green = Optional, Gray = Redaction.",
      "Drag the badge (numbered label) to any corner of the rectangle.",
      "Add a text description to each annotation — it will appear below the image.",
      "Click Save to persist annotations with the instruction.",
    ],
  },
  {
    icon: <Video size={20} />,
    title: "Video Content Blocks",
    badge: "Admin: Instructions",
    badgeVariant: "admin",
    description: "Embed video URLs (e.g. direct .mp4 links) in instructions for richer walkthroughs.",
    usage: [
      "Click + Add Video to add a video block.",
      "Paste a direct video URL (e.g., an MP4 link). The video will render with native browser controls.",
    ],
  },
  {
    icon: <Pencil size={20} />,
    title: "Rename Instructions per Mission",
    badge: "Admin: Missions",
    badgeVariant: "admin",
    description:
      "Instructions have a global title stored in the database, but each mission can show a different (mission-specific) title for the same instruction.",
    usage: [
      "Select an instruction in the Mission Instructions panel.",
      "Click Rename to open the rename dialog.",
      "Enter an alternative title. Leave it empty to fall back to the instruction's original title.",
      "The renamed title is stored only in the mission data — the instruction itself is unchanged.",
    ],
  },
  {
    icon: <GitBranch size={20} />,
    title: "IF / END-IF Conditional Blocks",
    badge: "Admin: Missions",
    badgeVariant: "admin",
    description:
      "Insert conditional branching markers in a mission's instruction list to denote steps that only apply in certain scenarios.",
    usage: [
      "Click the IF button to insert an IF marker after the selected instruction.",
      "Click END-IF to insert the closing marker.",
      "Edit the IF label text via Rename to describe the condition, e.g. IF using Mac.",
      "IF and END-IF are structural markers — they cannot be opened or edited as instructions.",
    ],
  },
  {
    icon: <MessageSquare size={20} />,
    title: "Comments in Missions",
    badge: "Admin: Missions",
    badgeVariant: "admin",
    description:
      "Add inline text comments to a mission's instruction list. Comments are visible to end users as informational notes.",
    usage: [
      "Click Comment to open the comment dialog.",
      "Type the comment text and click Add Comment.",
      "The comment appears in the instruction list with a chat-bubble prefix, italicized.",
      "Comments are stored only in the mission data — not in the instructions table.",
    ],
  },
  {
    icon: <Tag size={20} />,
    title: "Temporary (Placeholder) Instructions",
    badge: "Admin: Missions",
    badgeVariant: "admin",
    description:
      "Create a placeholder slot in a mission before the actual instruction content is ready. Temp entries appear as T1, T2, etc.",
    usage: [
      "Click + New to add a temporary instruction placeholder.",
      "Enter a working title — the placeholder is added to the mission list immediately.",
      "Temp entries are highlighted in blue and labeled with their temp ID (T1, T2, etc.).",
      "Use Link to associate a temp entry with an existing saved instruction ID.",
      "Use Edit on a temp entry to create a real instruction in the database and navigate to it immediately.",
    ],
  },
  {
    icon: <Repeat2 size={20} />,
    title: "Replace Instruction Across Missions",
    badge: "Admin: Instructions",
    badgeVariant: "admin",
    description:
      "Swap one instruction ID for another across all missions that reference it — useful when renumbering or merging content.",
    usage: [
      "Select the instruction to replace from the instruction list.",
      "Click Replace Instruction to open the replacement dialog.",
      "Enter the ID of the new instruction that should take its place.",
      "All missions using the old instruction will be updated automatically.",
    ],
  },
  {
    icon: <CircleDot size={20} />,
    title: "Mission List Color Index & ID Reference",
    badge: "Admin: Missions",
    badgeVariant: "admin",
    description:
      "The mission select dropdown uses colored circle emoji indicators to show how each mission is used. Mission and instruction IDs are the unique keys that tie the whole system together.",
    usage: [
      "🟢 Green circle — Mission is restricted to specific organizations (has org-level access rules).",
      "🟡 Yellow circle — Mission is referenced as a linked instruction step inside another mission.",
      "No circle — Mission visibility is determined by its example flag and organization access settings.",
      "Mission IDs: Unique string identifiers for each mission (e.g., 'security-basics', '101'). Used in URLs, in the mission select list, and when a mission is embedded as a Link-type instruction inside another mission.",
      "Instruction IDs: Numeric string identifiers assigned sequentially (e.g., '42', '43'). Each ID maps to one instruction record in the database. Shown in the available-instructions panel and inside each mission's instruction list.",
      "Instruction status color in selectors: Red = Only Title (no explanation written yet), default = Partial Explanation, Green = Full Explanation complete.",
      "Duplicate instruction entries use a #N suffix (e.g., '42#2') to allow the same instruction to appear more than once in one mission without losing its unique key.",
    ],
  },
  {
    icon: <Globe size={20} />,
    title: "Auto-Translation (DeepL)",
    badge: "Admin",
    badgeVariant: "admin",
    description:
      "Translate instruction or mission text from English to Hebrew (or vice versa) using the DeepL API integration.",
    usage: [
      "With an instruction or mission loaded, click Translate to Hebrew / English & Switch.",
      "All text fields (title, description, text blocks) are translated in one step.",
      "You are automatically switched to the target language after translation.",
      "Review and adjust the translation before saving to the database.",
    ],
  },
  {
    icon: <StickyNote size={20} />,
    title: "Admin Notes",
    badge: "Admin",
    badgeVariant: "admin",
    description:
      "Attach private notes to instructions or missions. These notes are only visible to admins and never shown to end users.",
    usage: [
      "Click + Admin Note in the instruction or mission editor to add a note.",
      "Notes are saved instantly to the database (no need to save the full record).",
      "Edit or remove individual notes using the Edit and remove buttons.",
      "Use notes to track TODOs, review comments, or context that authors need to know.",
    ],
  },
  {
    icon: <CheckCircle2 size={20} />,
    title: "Instruction Status Tracking",
    badge: "Admin: Instructions",
    badgeVariant: "admin",
    description:
      "Each instruction has a status field to track how complete its content is.",
    usage: [
      "Only Title (red) — title exists but no explanation has been written yet.",
      "Partial Explanation (orange) — explanation is started but not finished.",
      "Full Explanation (green) — instruction is complete and ready for use.",
      "The status color is visible in the instruction selector list for quick at-a-glance review.",
    ],
  },
];

function BadgePill({ variant, label }: { variant?: "admin" | "user" | "both"; label?: string }) {
  if (!variant && !label) return null;
  const text = label ?? (variant === "admin" ? "Admin" : variant === "user" ? "User" : "All");
  return (
    <span
      className={`${styles.badge} ${
        variant === "admin" ? styles.badgeAdmin : variant === "user" ? styles.badgeUser : styles.badgeBoth
      }`}
    >
      {text}
    </span>
  );
}

function FeatureCard({ feature }: { feature: FeatureItem }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureHeader}>
        <div className={styles.featureIconWrap}>{feature.icon}</div>
        <div className={styles.featureMeta}>
          <h3 className={styles.featureTitle}>{feature.title}</h3>
          {feature.badge ? (
            <BadgePill variant={feature.badgeVariant} label={feature.badge} />
          ) : (
            <BadgePill variant={feature.badgeVariant} />
          )}
        </div>
      </div>
      <p className={styles.featureDescription}>{feature.description}</p>
      <ul className={styles.featureUsage}>
        {feature.usage.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Help() {
  return (
    <div className={styles.helpContainer}>
      <div className={styles.helpContent}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Help &amp; Feature Guide</h1>
            <p className={styles.subtitle}>Everything you need to know about using GoalWay</p>
          </div>
          <Link to="/" className={styles.backButton}>
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>👤</span>
            <div>
              <h2 className={styles.sectionTitle}>End-User Features</h2>
              <p className={styles.sectionSubtitle}>Available to all users browsing missions</p>
            </div>
          </div>
          <div className={styles.featureGrid}>
            {USER_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🔒</span>
            <div>
              <h2 className={styles.sectionTitle}>Admin Features</h2>
              <p className={styles.sectionSubtitle}>Available to authenticated administrators only</p>
            </div>
          </div>
          <div className={styles.featureGrid}>
            {ADMIN_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} />
            ))}
          </div>
        </section>

        <div className={styles.callToAction}>
          <h2 className={styles.ctaTitle}>Ready to Get Started?</h2>
          <Link to="/" className={styles.ctaButton}>
            Browse Missions
          </Link>
        </div>
      </div>
    </div>
  );
}
