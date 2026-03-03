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
          <h1 className={styles.title}>How to Use GoalWay</h1>
          <Link to="/" className={styles.backButton}>
            <ArrowLeft size={20} />
            Back to Home
          </Link>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Welcome!</h2>
          <p className={styles.text}>
            GoalWay is your step-by-step guide for completing missions. Each mission contains step by step instructionss
            designed for effective use in real time.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Getting Started</h2>
          <ol className={styles.list}>
            <li>
              <strong>Filter Missions:</strong> Use the search box to filter missions by title or description. This
              helps you quickly find the mission you need.
            </li>
            <li>
              <strong>Select a Mission:</strong> Click on any mission card to open it and view its instructions.
            </li>
            <li>
              <strong>Use the Mission:</strong> If you are unsure how to perform a specific instruction, click it to
              view a detailed explanation. If you are already familiar with how to complete the mission, use the
              instruction list (without opening the instructions) as a reminder or to ensure you did not miss any
              steps.{" "}
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
              <strong>Track Progress:</strong> As you complete each instruction, Click it to close the details or click
              the next instruction. The instruction number badge will turn green to help you track your progress.
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
                details in sub-instructions.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Navigation Tips</h2>
          <ul className={styles.list}>
            <li>
              <strong>Return Home:</strong> Click the "Home" button in the navigation bar at any time to return to the
              mission list.
            </li>
            <li>
              <strong>Mission Progress:</strong> Your progress within a mission is tracked during your current visit but
              resets when you navigate away.
            </li>
            <li>
              <strong>Quick Access:</strong> Use the mission filter to quickly find and access frequently used missions.
            </li>
          </ul>
        </div>

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
