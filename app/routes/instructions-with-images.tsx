import { useState } from "react";
import type { Route } from "./+types/instructions-with-images";
import styles from "./instructions-with-images.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Instructions with Images" },
    {
      name: "description",
      content: "Visual step-by-step instructions with images",
    },
  ];
}

interface Instruction {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
}

export default function InstructionsWithImages() {
  const [instructions] = useState<Instruction[]>([
    {
      id: "1",
      title: "Step 1: Getting Started",
      description: "Begin your journey by understanding the basics",
      imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
    },
    {
      id: "2",
      title: "Step 2: Configuration",
      description: "Set up your environment and configure the settings",
      imageUrl: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=600&fit=crop",
    },
    {
      id: "3",
      title: "Step 3: Implementation",
      description: "Follow the implementation guidelines carefully",
      imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop",
    },
    {
      id: "4",
      title: "Step 4: Testing",
      description: "Verify everything works as expected",
      imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop",
    },
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Visual Instructions</h1>
          <p className={styles.subtitle}>
            Follow these step-by-step instructions to complete your task
          </p>
        </header>

        <div className={styles.instructionsList}>
          {instructions.map((instruction) => (
            <div key={instruction.id} className={styles.instructionItem}>
              {instruction.imageUrl && (
                <div className={styles.imageContainer}>
                  <img
                    src={instruction.imageUrl}
                    alt={instruction.title}
                    className={styles.image}
                  />
                </div>
              )}
              <div className={styles.textContent}>
                <h2 className={styles.instructionTitle}>{instruction.title}</h2>
                <p className={styles.instructionDescription}>
                  {instruction.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
