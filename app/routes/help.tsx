import { Link } from "react-router";
import type { Route } from "./+types/help";
import { ArrowLeft, FileText, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
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

export default function Help() {
  return (
    <div className={styles.helpContainer}>
      <div className={styles.helpContent}>
        <div className={styles.header}>
          <h1 className={styles.title}>How to Use Mission Control Center</h1>
          <Link to="/" className={styles.backButton}>
            <ArrowLeft size={20} />
            Back to Home
          </Link>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Welcome!</h2>
          <p className={styles.text}>
            The Mission Control Center is your step-by-step guide for completing missions. Each mission contains
            detailed instructions designed to help you achieve your goals efficiently and effectively.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Getting Started</h2>
          <ol className={styles.list}>
            <li>
              <strong>Browse Missions:</strong> On the home page, you'll see all available missions. Each mission card
              shows the title, description, and number of instructions.
            </li>
            <li>
              <strong>Filter Missions:</strong> Use the search box to filter missions by title or description. This
              helps you quickly find the mission you need.
            </li>
            <li>
              <strong>Select a Mission:</strong> Click on any mission card to open it and view its instructions.
            </li>
          </ol>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Working with Instructions</h2>
          <p className={styles.text}>
            Each mission contains a list of numbered instructions. Here's how to work with them:
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Click to Expand:</strong> Click on any instruction to see detailed explanations, screenshots, and
              additional information.
            </li>
            <li>
              <strong>Track Progress:</strong> As you complete each instruction, the instruction number badge will turn
              green to help you track your progress.
            </li>
            <li>
              <strong>Auto-Complete:</strong> When you click on a new instruction, the previous one is automatically
              marked as completed.
            </li>
            <li>
              <strong>Fresh Start:</strong> Every time you return to a mission, all instruction statuses reset, so you
              can practice as many times as needed.
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Understanding Instruction Symbols</h2>
          <p className={styles.text}>
            Instructions may contain different types of content. Look for these symbols to know what to expect:
          </p>
          <div className={styles.symbolsGrid}>
            <div className={styles.symbolCard}>
              <div className={styles.symbolIcon}>
                <FileText size={24} />
              </div>
              <h3 className={styles.symbolTitle}>Text Instructions</h3>
              <p className={styles.symbolDescription}>
                This icon indicates the instruction contains text-based explanations and guidance. Click to read the
                full details.
              </p>
            </div>

            <div className={styles.symbolCard}>
              <div className={styles.symbolIcon}>
                <ImageIcon size={24} />
              </div>
              <h3 className={styles.symbolTitle}>Visual Content</h3>
              <p className={styles.symbolDescription}>
                This icon means the instruction includes screenshots, diagrams, or images to help you understand the
                steps visually.
              </p>
            </div>

            <div className={styles.symbolCard}>
              <div className={styles.symbolIcon}>
                <LinkIcon size={24} />
              </div>
              <h3 className={styles.symbolTitle}>Related Instructions</h3>
              <p className={styles.symbolDescription}>
                This icon appears when an instruction is linked to other related instructions. Click to see expanded
                details and sub-instructions.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Tips for Success</h2>
          <ul className={styles.list}>
            <li>
              <strong>Follow in Order:</strong> Instructions are numbered for a reason. Follow them sequentially for
              the best results.
            </li>
            <li>
              <strong>Take Your Time:</strong> Don't rush. Each instruction builds on the previous one, so make sure
              you understand each step before moving forward.
            </li>
            <li>
              <strong>Use Visual Aids:</strong> When instructions include images, study them carefully. They provide
              valuable context and examples.
            </li>
            <li>
              <strong>Practice Makes Perfect:</strong> Since progress resets when you leave a mission, feel free to
              practice the same mission multiple times until you master it.
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Navigation Tips</h2>
          <ul className={styles.list}>
            <li>
              <strong>Return Home:</strong> Click the "Home" button in the navigation bar at any time to return to the
              mission list.
            </li>
            <li>
              <strong>Mission Progress:</strong> Your progress within a mission is tracked during your current visit
              but resets when you navigate away.
            </li>
            <li>
              <strong>Quick Access:</strong> Use the mission filter to quickly find and access frequently used
              missions.
            </li>
          </ul>
        </div>

        <div className={styles.callToAction}>
          <h2 className={styles.ctaTitle}>Ready to Get Started?</h2>
          <p className={styles.ctaText}>
            Now that you know how to use Mission Control Center, it's time to choose your first mission and start
            making progress!
          </p>
          <Link to="/" className={styles.ctaButton}>
            Browse Missions
          </Link>
        </div>
      </div>
    </div>
  );
}
