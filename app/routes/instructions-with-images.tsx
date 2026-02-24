import type { Route } from "./+types/instructions-with-images";
import { useSearchParams } from "react-router";
import { useState } from "react";
import styles from "./instructions-with-images.module.css";
import { getAllInstructions } from "~/services/instructions.server";
import { Checkbox } from "~/components/ui/checkbox/checkbox";

export async function loader({ request }: Route.LoaderArgs) {
  const instructions = await getAllInstructions();
  return { instructions };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Instructions with Images" },
    {
      name: "description",
      content: "Visual step-by-step instructions with images",
    },
  ];
}

export default function InstructionsWithImages({ loaderData }: Route.ComponentProps) {
  const { instructions } = loaderData;
  const [searchParams] = useSearchParams();
  const imageUrl = searchParams.get("imageUrl");
  const [selectedInstructions, setSelectedInstructions] = useState<Set<string>>(new Set());

  // Filter instructions to only show those containing this specific image
  // Note: searchParams.get() automatically decodes the URL, so imageUrl is already decoded
  const filteredInstructions = imageUrl
    ? instructions.filter((instruction) =>
        instruction.explanation?.some(
          (item) => item.type === "image" && item.content === imageUrl
        )
      )
    : instructions;

  // Use the provided image URL or fallback to default
  const displayImageUrl =
    imageUrl || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=600&fit=crop";

  // Handle checkbox toggle
  const handleToggleInstruction = (instructionId: string) => {
    setSelectedInstructions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(instructionId)) {
        newSet.delete(instructionId);
      } else {
        newSet.add(instructionId);
      }
      return newSet;
    });
  };

  // Handle select all / deselect all
  const handleToggleAll = () => {
    if (selectedInstructions.size === filteredInstructions.length) {
      setSelectedInstructions(new Set());
    } else {
      setSelectedInstructions(new Set(filteredInstructions.map((i) => i.id)));
    }
  };

  const allSelected = selectedInstructions.size === filteredInstructions.length && filteredInstructions.length > 0;
  const someSelected = selectedInstructions.size > 0 && selectedInstructions.size < filteredInstructions.length;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Visual Instructions</h1>
          <p className={styles.subtitle}>
            {imageUrl
              ? `Instructions using this image (${filteredInstructions.length} found)`
              : "Follow these step-by-step instructions to complete your task"}
          </p>
        </header>

        {/* Single picture at the top */}
        <div className={styles.imageContainer}>
          <img
            src={displayImageUrl}
            alt="Instructions overview"
            className={styles.image}
          />
        </div>

        {/* List of instruction titles */}
        <div className={styles.instructionsList}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {imageUrl ? "Instructions Using This Image" : "Available Instructions"}
            </h2>
            {filteredInstructions.length > 0 && (
              <div className={styles.selectionInfo}>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleToggleAll}
                  className={styles.selectAllCheckbox}
                  data-indeterminate={someSelected}
                />
                <span className={styles.selectionText}>
                  {selectedInstructions.size > 0
                    ? `${selectedInstructions.size} selected`
                    : "Select all"}
                </span>
              </div>
            )}
          </div>
          <div className={styles.instructionCheckboxList}>
            {filteredInstructions.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No instructions found using this image.</p>
              </div>
            ) : (
              filteredInstructions.map((instruction) => {
                const isSelected = selectedInstructions.has(instruction.id);
                return (
                  <div
                    key={instruction.id}
                    className={`${styles.instructionItem} ${isSelected ? styles.selected : ""}`}
                    onClick={() => handleToggleInstruction(instruction.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleInstruction(instruction.id)}
                      className={styles.checkbox}
                    />
                    <span className={styles.instructionId}>{instruction.id}</span>
                    <span className={styles.instructionTitle}>{instruction.title}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
