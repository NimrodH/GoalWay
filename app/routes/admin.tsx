import { useState, useEffect } from "react";
import { Form, useActionData, useNavigate, useSearchParams, Link, useFetcher } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { useAuth } from "~/hooks/use-auth";
import { initSupabase, getSupabase } from "~/lib/supabase";
import { uploadImage, listAllImages } from "~/lib/image-upload";
import type { Route } from "./+types/admin";
import styles from "./admin.module.css";
import { AppNavigation } from "~/components/app-navigation/app-navigation";
import {
  getAllInstructions,
  getAllInstructionsHe,
  getAllInstructionIds,
  type Instruction,
  type InstructionContent,
} from "~/services/instructions.server";

// Internal type for UI with unique keys for proper React rendering
type InstructionContentWithKey = InstructionContent & { _key?: string };
import { getAllMissions, getAllMissionsHe, getAllMissionIds, type Mission } from "~/services/missions.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = url.searchParams.get("lang") || "en";
  const tab = url.searchParams.get("tab") || "edit-instruction";

  const [instructions, missions, allInstructionIds, allMissionIds, instructionsEn, instructionsHe] = await Promise.all([
    language === "he" ? getAllInstructionsHe() : getAllInstructions(),
    language === "he" ? getAllMissionsHe() : getAllMissions(),
    getAllInstructionIds(),
    getAllMissionIds(),
    getAllInstructions(),
    getAllInstructionsHe(),
  ]);

  return {
    supabaseUrl: process.env.SUPABASE_PROJECT_URL!,
    supabaseKey: process.env.SUPABASE_API_KEY!,
    instructions,
    missions,
    allInstructionIds,
    allMissionIds,
    instructionsEn,
    instructionsHe,
    language,
    tab,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const id = formData.get("id") as string;
  const dataEn = formData.get("dataEn") as string;
  const dataHe = formData.get("dataHe") as string | null;
  const language = formData.get("language") as string;
  const accessToken = formData.get("accessToken") as string | null;

  // Handle replace instruction action
  if (actionType === "replaceInstruction") {
    const accessToken = formData.get("accessToken") as string | null;
    const oldInstructionId = formData.get("oldInstructionId") as string | null;
    const newInstructionId = formData.get("newInstructionId") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    if (!oldInstructionId || !newInstructionId) {
      return { success: false, error: "Both old and new instruction IDs are required" };
    }

    if (oldInstructionId === newInstructionId) {
      return { success: false, error: "Old and new instruction IDs cannot be the same" };
    }

    try {
      // Create authenticated Supabase client
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      // First, verify that the new instruction exists
      const { data: newInstructionExists, error: checkError } = await supabase
        .from("instructions")
        .select("id")
        .eq("id", newInstructionId)
        .single();

      if (checkError || !newInstructionExists) {
        return { success: false, error: `New instruction ${newInstructionId} does not exist` };
      }

      // Get all missions that use the old instruction
      const { data: allMissions, error: fetchError } = await supabase.from("missions").select("*");

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      let missionsUpdated = 0;

      // Update each mission to replace the old instruction with the new one
      if (allMissions && allMissions.length > 0) {
        const updatePromises = allMissions.map(async (missionRow: any) => {
          let updated = false;
          const updatedRow: any = { updated_at: new Date().toISOString() };

          // Check and update data_en
          if (missionRow.data_en && Array.isArray(missionRow.data_en.instructions)) {
            const updatedInstructions = missionRow.data_en.instructions.map((inst: [string, string?]) => {
              if (inst[0] === oldInstructionId) {
                // Replace the instruction ID but keep any custom title
                return [newInstructionId, inst[1]] as [string, string?];
              }
              return inst;
            });
            // Check if anything was actually replaced
            if (JSON.stringify(updatedInstructions) !== JSON.stringify(missionRow.data_en.instructions)) {
              updatedRow.data_en = {
                ...missionRow.data_en,
                instructions: updatedInstructions,
              };
              updated = true;
            }
          }
          // Also check for legacy instructionIds format
          if (missionRow.data_en && Array.isArray(missionRow.data_en.instructionIds)) {
            const updatedInstructionIds = missionRow.data_en.instructionIds.map((instId: string) => {
              if (instId === oldInstructionId) {
                return newInstructionId;
              }
              return instId;
            });
            // Check if anything was actually replaced
            if (JSON.stringify(updatedInstructionIds) !== JSON.stringify(missionRow.data_en.instructionIds)) {
              updatedRow.data_en = {
                ...missionRow.data_en,
                instructionIds: updatedInstructionIds,
              };
              updated = true;
            }
          }

          // Check and update data_he
          if (missionRow.data_he && Array.isArray(missionRow.data_he.instructions)) {
            const updatedInstructions = missionRow.data_he.instructions.map((inst: [string, string?]) => {
              if (inst[0] === oldInstructionId) {
                // Replace the instruction ID but keep any custom title
                return [newInstructionId, inst[1]] as [string, string?];
              }
              return inst;
            });
            // Check if anything was actually replaced
            if (JSON.stringify(updatedInstructions) !== JSON.stringify(missionRow.data_he.instructions)) {
              updatedRow.data_he = {
                ...missionRow.data_he,
                instructions: updatedInstructions,
              };
              updated = true;
            }
          }
          // Also check for legacy instructionIds format
          if (missionRow.data_he && Array.isArray(missionRow.data_he.instructionIds)) {
            const updatedInstructionIds = missionRow.data_he.instructionIds.map((instId: string) => {
              if (instId === oldInstructionId) {
                return newInstructionId;
              }
              return instId;
            });
            // Check if anything was actually replaced
            if (JSON.stringify(updatedInstructionIds) !== JSON.stringify(missionRow.data_he.instructionIds)) {
              updatedRow.data_he = {
                ...missionRow.data_he,
                instructionIds: updatedInstructionIds,
              };
              updated = true;
            }
          }

          // Update the mission if it was modified
          if (updated) {
            await supabase.from("missions").update(updatedRow).eq("id", missionRow.id);
            missionsUpdated++;
          }
        });

        await Promise.all(updatePromises);
      }

      return {
        success: true,
        message: `Instruction ${oldInstructionId} replaced with ${newInstructionId} in ${missionsUpdated} mission(s)!`,
        missionsUpdated,
      };
    } catch (error) {
      console.error("Error in replaceInstruction:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // Handle delete instruction action
  if (actionType === "deleteInstruction") {
    const accessToken = formData.get("accessToken") as string | null;
    const instructionId = formData.get("instructionId") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    if (!instructionId) {
      return { success: false, error: "Instruction ID is required" };
    }

    try {
      // Create authenticated Supabase client
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      // First, get all missions that use this instruction
      const { data: allMissions, error: fetchError } = await supabase.from("missions").select("*");

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      // Update each mission to remove the instruction
      if (allMissions && allMissions.length > 0) {
        const updatePromises = allMissions.map(async (missionRow: any) => {
          let updated = false;
          const updatedRow: any = { updated_at: new Date().toISOString() };

          // Check and update data_en
          if (missionRow.data_en && Array.isArray(missionRow.data_en.instructions)) {
            const filteredInstructions = missionRow.data_en.instructions.filter(
              (inst: [string, string?]) => inst[0] !== instructionId,
            );
            if (filteredInstructions.length !== missionRow.data_en.instructions.length) {
              updatedRow.data_en = {
                ...missionRow.data_en,
                instructions: filteredInstructions,
              };
              updated = true;
            }
          }

          // Check and update data_he
          if (missionRow.data_he && Array.isArray(missionRow.data_he.instructions)) {
            const filteredInstructions = missionRow.data_he.instructions.filter(
              (inst: [string, string?]) => inst[0] !== instructionId,
            );
            if (filteredInstructions.length !== missionRow.data_he.instructions.length) {
              updatedRow.data_he = {
                ...missionRow.data_he,
                instructions: filteredInstructions,
              };
              updated = true;
            }
          }

          // Update the mission if it was modified
          if (updated) {
            await supabase.from("missions").update(updatedRow).eq("id", missionRow.id);
          }
        });

        await Promise.all(updatePromises);
      }

      // Delete the instruction
      const { error } = await supabase.from("instructions").delete().eq("id", instructionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: `Instruction ${instructionId} deleted successfully and removed from all missions!`,
        deletedInstructionId: instructionId,
      };
    } catch (error) {
      console.error("Error in deleteInstruction:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // Handle delete mission action
  if (actionType === "deleteMission") {
    const accessToken = formData.get("accessToken") as string | null;
    const missionId = formData.get("missionId") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    if (!missionId) {
      return { success: false, error: "Mission ID is required" };
    }

    try {
      // Create authenticated Supabase client
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      // Delete the mission
      const { error } = await supabase.from("missions").delete().eq("id", missionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: `Mission ${missionId} deleted successfully!`,
        deletedMissionId: missionId,
      };
    } catch (error) {
      console.error("Error in deleteMission:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // Handle create new mission action
  if (actionType === "createMission") {
    const accessToken = formData.get("accessToken") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    try {
      // Create authenticated Supabase client
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      // Get all existing mission IDs
      const { data: existingMissions, error: fetchError } = await supabase
        .from("missions")
        .select("id")
        .order("created_at", { ascending: true });

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      // Find the highest numeric ID
      const numericIds = (existingMissions || [])
        .map((m: any) => parseInt(m.id, 10))
        .filter((id: number) => !isNaN(id));

      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);

      // Create empty mission object
      const emptyMission = {
        id: newId,
        title: "",
        description: "",
        instructions: [],
      };

      // Insert the new mission
      const insertData: any = {
        id: newId,
        data_en: emptyMission,
        data_he: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("missions").insert(insertData);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: `New mission ${newId} created successfully!`,
        newMissionId: newId,
      };
    } catch (error) {
      console.error("Error in createMission:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // Handle create new instruction action
  if (actionType === "createInstruction") {
    const newId = formData.get("newId") as string;
    const targetLanguage = formData.get("language") as string;
    const accessToken = formData.get("accessToken") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    // Create authenticated Supabase client
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Check if instruction already exists
    const { data: existingData } = await supabase.from("instructions").select("id").eq("id", newId).single();

    if (existingData) {
      return { success: false, error: `Instruction with ID ${newId} already exists` };
    }

    // Create empty instruction object
    const emptyInstruction = {
      id: newId,
      title: "",
      explanation: [],
    };

    // Insert the new instruction
    const insertData: any = {
      id: newId,
      data_en: targetLanguage === "en" ? emptyInstruction : { id: newId, title: "", explanation: [] },
      data_he: targetLanguage === "he" ? emptyInstruction : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("instructions").insert(insertData);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `New instruction ${newId} created successfully!`,
      newInstructionId: newId,
    };
  }

  // Handle translation action (no auth required for translation)
  if (actionType === "translate") {
    const { translateText } = await import("~/lib/translate");
    const sourceLang = formData.get("sourceLang") as "en" | "he";
    const targetLang = formData.get("targetLang") as "en" | "he";
    const textToTranslate = formData.get("text") as string;

    const result = await translateText(textToTranslate, sourceLang, targetLang);

    if (result.error) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      translatedText: result.translatedText,
    };
  }

  // Verify auth token is provided for save operations
  if (!accessToken) {
    return { success: false, error: "Unauthorized: Authentication required" };
  }

  // Create authenticated Supabase client
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  if (actionType === "saveInstruction") {
    const instructionData = JSON.parse(dataEn);

    // Check if the row exists
    const { data: existingData } = await supabase.from("instructions").select("id").eq("id", id).single();

    if (!existingData) {
      // Row doesn't exist, we need to insert with data_en at minimum
      const insertData: any = {
        id,
        data_en: language === "en" ? instructionData : {},
        data_he: language === "he" ? instructionData : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("instructions").insert(insertData);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      // Row exists, update only the relevant language column
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (language === "he") {
        updateData.data_he = instructionData;
      } else {
        updateData.data_en = instructionData;
      }

      const { error } = await supabase.from("instructions").update(updateData).eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return {
      success: true,
      message: "Instruction saved successfully!",
    };
  } else if (actionType === "saveMission") {
    const missionData = JSON.parse(dataEn);

    // Check if the row exists
    const { data: existingData } = await supabase.from("missions").select("id").eq("id", id).single();

    if (!existingData) {
      // Row doesn't exist, we need to insert with data_en at minimum
      const insertData: any = {
        id,
        data_en: language === "en" ? missionData : {},
        data_he: language === "he" ? missionData : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("missions").insert(insertData);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      // Row exists, update only the relevant language column
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (language === "he") {
        updateData.data_he = missionData;
      } else {
        updateData.data_en = missionData;
      }

      const { error } = await supabase.from("missions").update(updateData).eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return {
      success: true,
      message: "Mission saved successfully!",
    };
  }

  return { success: false, error: "Invalid action type" };
}

// Image Library Dialog Component
function ImageLibraryDialog({
  isOpen,
  onClose,
  onSelectImage,
  instructions,
  instructionsEn,
  instructionsHe,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  instructions: Instruction[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
}) {
  const [images, setImages] = useState<Array<{ name: string; url: string; path: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadImages();
      setSelectedImages(new Set());
      setPreviewImage(null);
    }
  }, [isOpen]);

  const loadImages = async () => {
    setIsLoading(true);
    setError(null);
    const result = await listAllImages();
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setImages(result.images);
    }
  };

  // Check if an image URL is used in any instruction (check both languages)
  const isImageUsed = (imageUrl: string) => {
    const allInstructions = [...instructionsEn, ...instructionsHe];
    const found = allInstructions.some((instruction) => {
      // Skip if instruction has no explanation or it's not an array
      if (!instruction.explanation || !Array.isArray(instruction.explanation)) {
        return false;
      }
      return instruction.explanation.some((item) => 
        item.type === 'image' && item.content === imageUrl
      );
    });
    // Console log for debugging (will show in browser console)
    if (!found) {
      console.log('Image not found in any instruction:', imageUrl);
      console.log('Total instructions checked:', allInstructions.length);
      const instructionsWithExplanation = allInstructions.filter(i => i.explanation && Array.isArray(i.explanation) && i.explanation.length > 0);
      console.log('Instructions with explanations:', instructionsWithExplanation.length);
      const allImageUrls = instructionsWithExplanation.flatMap(i => 
        i.explanation!.filter(e => e.type === 'image').map(e => e.content)
      );
      console.log('All image URLs in instructions:', allImageUrls);
    }
    return found;
  };

  // Toggle image selection
  const toggleImageSelection = (imagePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imagePath)) {
        newSet.delete(imagePath);
      } else {
        newSet.add(imagePath);
      }
      return newSet;
    });
  };

  // Delete selected images
  const handleDeleteSelected = async () => {
    if (selectedImages.size === 0) {
      alert('Please select at least one image to delete');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedImages.size} image(s)?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    setIsDeleting(true);
    const { deleteImage } = await import('~/lib/image-upload');
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const imagePath of selectedImages) {
      const result = await deleteImage(imagePath);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        errors.push(`${imagePath}: ${result.error}`);
      }
    }

    setIsDeleting(false);

    if (errorCount > 0) {
      alert(`Deleted ${successCount} image(s).\nFailed to delete ${errorCount} image(s):\n${errors.join('\n')}`);
    } else {
      alert(`Successfully deleted ${successCount} image(s)!`);
    }

    // Reload images and clear selection
    setSelectedImages(new Set());
    await loadImages();
  };

  if (!isOpen) return null;

  // If preview mode is active, show the large preview
  if (previewImage) {
    return (
      <div className={styles.dialogOverlay} onClick={() => setPreviewImage(null)}>
        <div
          className={styles.dialogContent}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        >
          <div className={styles.dialogHeader}>
            <h2 className={styles.dialogTitle}>{previewImage.name}</h2>
            <button className={styles.dialogClose} onClick={() => setPreviewImage(null)}>
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', background: 'var(--color-neutral-2)' }}>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--radius-2)' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dialogOverlay} onClick={onClose}>
      <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>Select Image from Library</h2>
          <button className={styles.dialogClose} onClick={onClose}>
            ✕
          </button>
        </div>

        {isLoading && <div className={styles.dialogLoading}>Loading images...</div>}

        {error && <div className={styles.errorMessage}>{error}</div>}

        {!isLoading && !error && images.length === 0 && (
          <div className={styles.dialogEmpty}>No images found in storage</div>
        )}

        {!isLoading && !error && images.length > 0 && (
          <>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-neutral-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-11)' }}>
                {selectedImages.size > 0 ? `${selectedImages.size} image(s) selected` : 'Select images to delete'}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => {
                    const selectedImagePath = Array.from(selectedImages)[0];
                    const selectedImage = images.find(img => img.path === selectedImagePath);
                    if (selectedImage) {
                      onSelectImage(selectedImage.url);
                      onClose();
                    }
                  }}
                  className={styles.submitButton}
                  disabled={selectedImages.size !== 1}
                  style={{ minWidth: '100px' }}
                >
                  ✓ Select
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const selectedImagePath = Array.from(selectedImages)[0];
                    const selectedImage = images.find(img => img.path === selectedImagePath);
                    if (selectedImage) {
                      window.location.href = `/instructions-with-images?imageUrl=${encodeURIComponent(selectedImage.url)}`;
                    }
                  }}
                  className={styles.addButton}
                  disabled={selectedImages.size !== 1}
                  style={{ minWidth: '180px' }}
                >
                  🔍 View Instructions with Image
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className={styles.removeButton}
                  disabled={selectedImages.size === 0 || isDeleting}
                  style={{ minWidth: '100px' }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Selected'}
                </button>
              </div>
            </div>
            <div className={styles.imageGrid}>
              {images.map((image) => {
                const isUsed = isImageUsed(image.url);
                const isSelected = selectedImages.has(image.path);
                return (
                  <div
                    key={image.path}
                    className={styles.imageGridItem}
                    onClick={() => {
                      setPreviewImage({ url: image.url, name: image.name });
                    }}
                    style={{
                      position: 'relative',
                      border: isSelected ? '3px solid var(--color-accent-9)' : undefined,
                      opacity: isUsed ? 1 : 0.6,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 'var(--space-2)',
                        left: 'var(--space-2)',
                        zIndex: 10,
                      }}
                      onClick={(e) => toggleImageSelection(image.path, e)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </div>
                    {!isUsed && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'var(--space-2)',
                          right: 'var(--space-2)',
                          background: 'var(--color-error-9)',
                          color: 'white',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: 'var(--radius-2)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          zIndex: 5,
                          pointerEvents: 'none',
                        }}
                      >
                        Not Used
                      </div>
                    )}
                    <img src={image.url} alt={image.name} className={styles.imageGridThumb} />
                    <div className={styles.imageGridName}>{image.name}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Component for individual explanation content items with image upload
function ExplanationContentItem({
  item,
  index,
  onUpdate,
  onRemove,
  isSelected,
  onSelect,
  instructions,
  instructionsEn,
  instructionsHe,
  onNavigationRequest,
}: {
  item: InstructionContentWithKey;
  index: number;
  onUpdate: (index: number, content: string) => void;
  onRemove: (index: number) => void;
  isSelected: boolean;
  onSelect: (index: number) => void;
  instructions: Instruction[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  onNavigationRequest: (navigationFn: () => void) => void;
}) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(item.type === "image" ? item.content : "");
  const [isUploading, setIsUploading] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      // Method 1: Try Clipboard API first (modern browsers)
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          // Check if permission API is available
          if (navigator.permissions) {
            const permissionStatus = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
            console.log("Clipboard permission:", permissionStatus.state);

            // If explicitly denied, inform user immediately
            if (permissionStatus.state === "denied") {
              throw new Error(
                "Clipboard access denied. Please enable it in your browser settings or use the manual paste method.",
              );
            }
          }

          // Try to read from clipboard
          const clipboardItems = await navigator.clipboard.read();
          console.log("Clipboard items count:", clipboardItems.length);

          for (const item of clipboardItems) {
            console.log("Available clipboard types:", item.types);

            // Look for image types
            const imageType = item.types.find((type) => type.startsWith("image/"));

            if (imageType) {
              console.log("Found image type:", imageType);
              const blob = await item.getType(imageType);
              console.log("Blob size:", blob.size, "bytes");

              // Convert blob to File object
              const timestamp = Date.now();
              const extension = imageType.split("/")[1] || "png";
              const file = new File([blob], `pasted-image-${timestamp}.${extension}`, { type: blob.type });

              setImageFile(file);

              // Create preview
              const reader = new FileReader();
              reader.onloadend = () => {
                setImagePreview(reader.result as string);
              };
              reader.readAsDataURL(blob);

              alert(`Image pasted successfully! (${Math.round(blob.size / 1024)}KB)`);
              return; // Exit after finding first image
            }
          }

          // No image found in clipboard
          const allTypes = clipboardItems.flatMap((item) => item.types).join(", ");
          alert(
            `No image found in clipboard.\n\nAvailable formats: ${allTypes || "none"}\n\nTip: Right-click on an image and select "Copy Image", or use a screenshot tool.`,
          );
          return;
        } catch (clipboardError) {
          // Log error but don't throw - we'll try the fallback method
          console.warn("Clipboard API failed, trying fallback:", clipboardError);
        }
      }

      // Method 2: Fallback - instruct user to use manual paste event
      alert(
        'Clipboard API not available or access denied.\n\nTry this instead:\n1. Click in the "Paste Zone" box below\n2. Press Ctrl+V (or Cmd+V on Mac)\n\nOR\n\nUse the file upload button to select an image manually.',
      );

      // Create a paste zone element if it doesn't exist
      const existingPasteZone = document.getElementById("manual-paste-zone");
      if (!existingPasteZone) {
        const pasteZone = document.createElement("div");
        pasteZone.id = "manual-paste-zone";
        pasteZone.contentEditable = "true";
        pasteZone.style.cssText = `
          border: 2px dashed var(--color-accent-8);
          border-radius: var(--radius-2);
          padding: var(--space-4);
          margin-top: var(--space-2);
          text-align: center;
          color: var(--color-neutral-11);
          background: var(--color-accent-2);
          cursor: text;
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        pasteZone.textContent = "📋 Click here and press Ctrl+V (or Cmd+V) to paste an image";

        // Handle paste event on this element
        pasteZone.addEventListener("paste", async (e: ClipboardEvent) => {
          e.preventDefault();
          const items = e.clipboardData?.items;
          if (!items) return;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
              const blob = item.getAsFile();
              if (blob) {
                const timestamp = Date.now();
                const extension = blob.type.split("/")[1] || "png";
                const file = new File([blob], `pasted-image-${timestamp}.${extension}`, { type: blob.type });

                setImageFile(file);

                // Create preview
                const reader = new FileReader();
                reader.onloadend = () => {
                  setImagePreview(reader.result as string);
                };
                reader.readAsDataURL(blob);

                // Remove paste zone after success
                pasteZone.remove();
                alert(`Image pasted successfully! (${Math.round(blob.size / 1024)}KB)`);
                return;
              }
            }
          }

          alert("No image found in the pasted content. Please copy an image and try again.");
        });

        // Insert the paste zone after the button
        const pasteButton = document.querySelector('[data-paste-button]');
        if (pasteButton && pasteButton.parentElement) {
          pasteButton.parentElement.insertBefore(pasteZone, pasteButton.nextSibling);
          pasteZone.focus();
        }
      } else {
        existingPasteZone.focus();
      }
    } catch (error) {
      console.error("Paste operation error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      alert(
        `Paste failed: ${errorMessage}\n\nAlternative:\nUse the file upload button below to select an image from your computer.`,
      );
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, "instructions");
    setIsUploading(false);

    if ("error" in result) {
      alert(`Upload failed: ${result.error}`);
    } else {
      setImagePreview(result.url);
      onUpdate(index, result.url);
      alert("Image uploaded successfully!");
    }
  };

  const handleSelectFromLibrary = (url: string) => {
    setImagePreview(url);
    onUpdate(index, url);
  };

  return (
    <div className={styles.contentItem} style={{ border: isSelected ? "2px solid var(--color-accent-9)" : undefined }}>
      <div className={styles.contentItemHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <input
            type="radio"
            name="contentItemRadio"
            checked={isSelected}
            onChange={() => onSelect(index)}
            style={{ cursor: "pointer" }}
          />
          <span className={styles.contentItemType}>{item.type}</span>
        </div>
        <button className={styles.removeButton} onClick={() => onRemove(index)}>
          Remove
        </button>
      </div>

      {item.type === "text" ? (
        <textarea
          className={styles.textarea}
          value={item.content}
          onChange={(e) => onUpdate(index, e.target.value)}
          placeholder="Enter text content..."
        />
      ) : item.type === "image" ? (
        <div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Image URL</label>
            <input
              type="text"
              className={styles.input}
              value={item.content}
              onChange={(e) => onUpdate(index, e.target.value)}
              placeholder="Enter image URL or upload below..."
            />
          </div>
          <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
            <label className={styles.label}>Upload New Image or Select from Library</label>
            <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <button type="button" onClick={() => setShowImageLibrary(true)} className={styles.addButton}>
                📚 Select from Library
              </button>
              <button type="button" onClick={handlePasteFromClipboard} className={styles.addButton} data-paste-button>
                📋 Paste from Clipboard
              </button>
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange} className={styles.input} />
            {imagePreview && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <img src={imagePreview} alt="Preview" style={{ maxWidth: "200px", borderRadius: "var(--radius-2)" }} />
              </div>
            )}
            {imageFile && !isUploading && (
              <button
                type="button"
                onClick={handleImageUpload}
                className={styles.addButton}
                style={{ marginTop: "var(--space-2)" }}
              >
                Upload to Supabase
              </button>
            )}
            {isUploading && (
              <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>Uploading...</p>
            )}
          </div>
          {item.content && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <button
                type="button"
                onClick={() => {
                  onNavigationRequest(() => {
                    window.location.href = `/instructions-with-images?imageUrl=${encodeURIComponent(item.content)}`;
                  });
                }}
                className={styles.addButton}
                style={{ display: "inline-block" }}
              >
                🔍 View Instructions with This Image
              </button>
            </div>
          )}
          <ImageLibraryDialog
            isOpen={showImageLibrary}
            onClose={() => setShowImageLibrary(false)}
            onSelectImage={handleSelectFromLibrary}
            instructions={instructions}
            instructionsEn={instructionsEn}
            instructionsHe={instructionsHe}
          />
        </div>
      ) : (
        <input
          type="text"
          className={styles.input}
          value={item.content}
          onChange={(e) => onUpdate(index, e.target.value)}
          placeholder={`Enter ${item.type} URL...`}
        />
      )}
    </div>
  );
}

// Component to handle authenticated form submissions
function AuthenticatedForm({
  actionType,
  id,
  data,
  disabled,
  language,
}: {
  actionType: string;
  id: string;
  data: string;
  disabled: boolean;
  language: string;
}) {
  const { session } = useAuth();

  return (
    <Form method="post" style={{ marginTop: "var(--space-4)" }}>
      <input type="hidden" name="actionType" value={actionType} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dataEn" value={data} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="accessToken" value={session?.access_token || ""} />
      <button type="submit" className={styles.submitButton} disabled={disabled || !session}>
        Save to Database ({language === "he" ? "Hebrew" : "English"})
      </button>
    </Form>
  );
}

export default function AdminPage({ loaderData }: Route.ComponentProps) {
  const { supabaseUrl, supabaseKey, instructions, missions, allInstructionIds, allMissionIds, instructionsEn, instructionsHe, language, tab } =
    loaderData;
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState(tab);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Add Ctrl+S keyboard shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // Prevent browser save dialog

        // Find and click the save button
        const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (saveButton && !saveButton.disabled) {
          saveButton.click();
        }
      }
    };

    // Attach event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Initialize Supabase on the client
  useEffect(() => {
    initSupabase(supabaseUrl, supabaseKey);
  }, [supabaseUrl, supabaseKey]);

  // Handle tab change with unsaved changes check
  const handleTabChange = (newTab: string) => {
    if (hasUnsavedChanges && newTab !== currentTab) {
      setPendingTab(newTab);
    } else {
      setCurrentTab(newTab);
    }
  };

  // Handle navigation with unsaved changes check
  const handleNavigationWithCheck = (navigationFn: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => navigationFn);
    } else {
      navigationFn();
    }
  };

  // Confirm discard changes
  const confirmDiscardChanges = () => {
    if (pendingTab) {
      setHasUnsavedChanges(false);
      setCurrentTab(pendingTab);
      setPendingTab(null);
    }
    if (pendingNavigation) {
      setHasUnsavedChanges(false);
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Save and navigate
  const saveAndNavigate = () => {
    // Trigger save by finding the active form's submit button and clicking it
    const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (saveButton) {
      saveButton.click();
    }
    // After save, navigate to the new tab or execute pending navigation
    setTimeout(() => {
      setHasUnsavedChanges(false);
      if (pendingTab) {
        setCurrentTab(pendingTab);
        setPendingTab(null);
      }
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
    }, 100);
  };

  // Cancel tab change
  const cancelTabChange = () => {
    setPendingTab(null);
    setPendingNavigation(null);
  };

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", currentTab);
    if (language) {
      params.set("lang", language);
    }
    navigate(`/admin?${params.toString()}`, { replace: true });
  }, [currentTab, language]);

  const clearActionData = () => {
    const params = new URLSearchParams();
    params.set("tab", currentTab);
    params.set("lang", language);
    navigate(`/admin?${params.toString()}`, { replace: true });
  };

  const switchLanguage = (newLang: string) => {
    const params = new URLSearchParams();
    params.set("tab", currentTab);
    params.set("lang", newLang);
    navigate(`/admin?${params.toString()}`);
  };

  const { user, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSigningIn(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    }

    setIsSigningIn(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loginContainer}>
          <div className={styles.loginCard}>
            <h1 className={styles.loginTitle}>Admin Login</h1>
            <p className={styles.loginSubtitle}>Sign in to access the admin panel</p>

            <form onSubmit={handleSignIn} className={styles.loginForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Password</label>
                <input
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && <div className={styles.errorMessage}>{error}</div>}

              <button type="submit" className={styles.submitButton} disabled={isSigningIn}>
                {isSigningIn ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <AppNavigation />
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>Developer Admin Panel</h1>
            <p className={styles.subtitle}>Create and manage instructions and missions</p>
          </div>
          <div className={styles.userInfo}>
            <button
              onClick={() => handleNavigationWithCheck(() => navigate("/"))}
              className={styles.homeButton}
              style={{ cursor: "pointer" }}
            >
              Go to Home
            </button>
            <div className={styles.languageToggle}>
              <button
                type="button"
                onClick={() => switchLanguage("en")}
                className={language === "en" ? styles.languageActive : styles.languageInactive}
              >
                English
              </button>
              <span className={styles.languageSeparator}>|</span>
              <button
                type="button"
                onClick={() => switchLanguage("he")}
                className={language === "he" ? styles.languageActive : styles.languageInactive}
              >
                Hebrew
              </button>
            </div>
            {user.email}
            <span className={styles.userEmail}></span>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <Tabs value={currentTab} onValueChange={handleTabChange} className={styles.tabs}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="edit-instruction">Edit Instruction</TabsTrigger>
          <TabsTrigger value="edit-mission">Edit Mission</TabsTrigger>
        </TabsList>

        <TabsContent value="edit-instruction">
          <EditInstructionForm
            actionData={actionData}
            clearActionData={clearActionData}
            instructions={instructions}
            missions={missions}
            allInstructionIds={allInstructionIds}
            allMissionIds={allMissionIds}
            instructionsEn={instructionsEn}
            instructionsHe={instructionsHe}
            language={language}
            onChangesDetected={setHasUnsavedChanges}
            onNavigationRequest={handleNavigationWithCheck}
          />
        </TabsContent>

        <TabsContent value="edit-mission">
          <EditMissionForm
            actionData={actionData}
            clearActionData={clearActionData}
            instructions={instructions}
            missions={missions}
            allMissionIds={allMissionIds}
            instructionsEn={instructionsEn}
            instructionsHe={instructionsHe}
            language={language}
            onChangesDetected={setHasUnsavedChanges}
            onNavigationRequest={handleNavigationWithCheck}
          />
        </TabsContent>
      </Tabs>

      {/* Unsaved Changes Warning Dialog */}
      {(pendingTab || pendingNavigation) && (
        <div className={styles.dialogOverlay}>
          <div className={styles.warningDialog}>
            <div className={styles.warningDialogHeader}>
              <h2 className={styles.warningDialogTitle}>Unsaved Changes</h2>
            </div>
            <p className={styles.warningDialogText}>
              You have unsaved changes. Do you want to save them before leaving?
            </p>
            <div className={styles.warningDialogButtons}>
              <button className={styles.addButton} onClick={cancelTabChange}>
                Cancel
              </button>
              <button className={styles.submitButton} onClick={saveAndNavigate}>
                Save
              </button>
              <button className={styles.removeButton} onClick={confirmDiscardChanges}>
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditInstructionForm({
  actionData,
  clearActionData,
  instructions,
  missions,
  allInstructionIds,
  allMissionIds,
  instructionsEn,
  instructionsHe,
  language,
  onChangesDetected,
  onNavigationRequest,
}: {
  actionData?: {
    success: boolean;
    message?: string;
    error?: string;
    imageUrl?: string;
    translatedText?: string | null;
    newInstructionId?: string;
  };
  clearActionData: () => void;
  instructions: Instruction[];
  missions: Mission[];
  allInstructionIds: string[];
  allMissionIds: string[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
}) {
  const [searchParams] = useSearchParams();
  const [selectedInstructionId, setSelectedInstructionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"default" | "link">("default");
  const [status, setStatus] = useState<"only title" | "partial explanation" | "full explanation">("only title");
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContentWithKey[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const [originalCode, setOriginalCode] = useState("");
  const fetcher = useFetcher<typeof action>();
  const deleteInstructionFetcher = useFetcher<typeof action>();
  const replaceInstructionFetcher = useFetcher<typeof action>();
  const [selectedContentIndex, setSelectedContentIndex] = useState<number | null>(null);
  const [instructionFilterEdit, setInstructionFilterEdit] = useState("");
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [replacementInstructionId, setReplacementInstructionId] = useState("");

  // Track changes
  useEffect(() => {
    if (selectedInstructionId) {
      const currentCode = generateCode();
      if (originalCode === "") {
        setOriginalCode(currentCode);
      } else {
        onChangesDetected(currentCode !== originalCode);
      }
    }
  }, [id, title, description, type, status, missionId, explanation, selectedInstructionId]);

  // Reset on save or instruction change
  useEffect(() => {
    if (actionData?.success || selectedInstructionId) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
  }, [actionData, selectedInstructionId]);

  // Auto-reload after successful save to refresh instruction list with updated data
  useEffect(() => {
    if (actionData?.success && actionData.message && id) {
      const timer = setTimeout(() => {
        window.location.href = `/admin?tab=edit-instruction&lang=${language}&instructionId=${id}`;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [actionData, id, language]);

  // Handle URL parameter for instruction selection
  useEffect(() => {
    const instructionIdFromUrl = searchParams.get("instructionId");
    if (
      instructionIdFromUrl &&
      allInstructionIds.includes(instructionIdFromUrl) &&
      selectedInstructionId !== instructionIdFromUrl
    ) {
      updateFormFields(instructionIdFromUrl);
    }
  }, [searchParams, allInstructionIds, selectedInstructionId]);

  // Watch for fetcher completion
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      if (fetcher.data.success && fetcher.data.newInstructionId) {
        // Reload the page to refresh with the new instruction selected
        window.location.href = `/admin?tab=edit-instruction&lang=${language}&instructionId=${fetcher.data.newInstructionId}`;
      } else if (fetcher.data.error) {
        alert(`Failed to create instruction: ${fetcher.data.error}`);
      }
    }
  }, [fetcher.data, fetcher.state, language]);

  // Watch for delete instruction fetcher completion
  useEffect(() => {
    if (deleteInstructionFetcher.data && deleteInstructionFetcher.state === "idle") {
      if (deleteInstructionFetcher.data.success) {
        alert(deleteInstructionFetcher.data.message || "Instruction deleted successfully!");
        // Clear the selected instruction and reload the page
        window.location.href = `/admin?tab=edit-instruction&lang=${language}`;
      } else if (deleteInstructionFetcher.data.error) {
        alert(`Failed to delete instruction: ${deleteInstructionFetcher.data.error}`);
      }
    }
  }, [deleteInstructionFetcher.data, deleteInstructionFetcher.state, language]);

  // Watch for replace instruction fetcher completion
  useEffect(() => {
    if (replaceInstructionFetcher.data && replaceInstructionFetcher.state === "idle") {
      if (replaceInstructionFetcher.data.success) {
        alert(replaceInstructionFetcher.data.message || "Instruction replaced successfully!");
        // Close the dialog
        setShowReplaceDialog(false);
        setReplacementInstructionId("");
        // Reload the page to refresh the mission list
        window.location.href = `/admin?tab=edit-instruction&lang=${language}&instructionId=${selectedInstructionId}`;
      } else if (replaceInstructionFetcher.data.error) {
        alert(`Failed to replace instruction: ${replaceInstructionFetcher.data.error}`);
      }
    }
  }, [replaceInstructionFetcher.data, replaceInstructionFetcher.state, language, selectedInstructionId]);

  const handleAddNewInstruction = () => {
    onNavigationRequest(() => {
      // Find the highest ID from existing instructions
      const numericIds = allInstructionIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);

      // Create the new instruction via fetcher
      const formData = new FormData();
      formData.append("actionType", "createInstruction");
      formData.append("newId", newId);
      formData.append("language", language);
      formData.append("accessToken", session?.access_token || "");

      fetcher.submit(formData, { method: "post" });
    });
  };

  const handleDeleteInstruction = () => {
    if (!selectedInstructionId) {
      alert("Please select an instruction first");
      return;
    }

    const instruction = instructions.find((i) => i.id === selectedInstructionId);
    const instructionTitle = instruction ? instruction.title : "(No title)";

    const confirmDelete = window.confirm(
      `Are you sure you want to delete instruction "${selectedInstructionId} - ${instructionTitle}"?\n\nThis action cannot be undone and will remove the instruction from the database.`,
    );

    if (!confirmDelete) {
      return;
    }

    // Create the delete request
    const formData = new FormData();
    formData.append("actionType", "deleteInstruction");
    formData.append("instructionId", selectedInstructionId);
    formData.append("accessToken", session?.access_token || "");

    deleteInstructionFetcher.submit(formData, { method: "post" });
  };

  const handleReplaceInstruction = () => {
    if (!selectedInstructionId) {
      alert("Please select an instruction first");
      return;
    }

    if (!replacementInstructionId.trim()) {
      alert("Please enter a replacement instruction ID");
      return;
    }

    const instruction = instructions.find((i) => i.id === selectedInstructionId);
    const instructionTitle = instruction ? instruction.title : "(No title)";

    const confirmReplace = window.confirm(
      `Are you sure you want to replace instruction "${selectedInstructionId} - ${instructionTitle}" with instruction "${replacementInstructionId}" in all missions?\n\nThis action will update all missions that use this instruction.`,
    );

    if (!confirmReplace) {
      return;
    }

    // Create the replace request
    const formData = new FormData();
    formData.append("actionType", "replaceInstruction");
    formData.append("oldInstructionId", selectedInstructionId);
    formData.append("newInstructionId", replacementInstructionId.trim());
    formData.append("accessToken", session?.access_token || "");

    replaceInstructionFetcher.submit(formData, { method: "post" });
  };

  const updateFormFields = (instructionId: string) => {
    setSelectedInstructionId(instructionId);
    const instruction = instructions.find((i) => i.id === instructionId);
    if (instruction) {
      setId(instruction.id);
      setTitle(instruction.title);
      setDescription(instruction.description || "");
      setType(instruction.type || "default");
      setStatus(instruction.status || "only title");
      setMissionId(instruction.missionId || "");
      // Add unique keys to explanation items if they don't have them
      const explanationWithKeys: InstructionContentWithKey[] = (instruction.explanation || []).map((item, idx) => ({
        ...item,
        _key: `content-${Date.now()}-${idx}-${Math.random()}`,
      }));
      setExplanation(explanationWithKeys);
    } else {
      // No data for this language, start with empty fields
      setId(instructionId);
      setTitle("");
      setDescription("");
      setType("default");
      setStatus("only title");
      setMissionId("");
      setExplanation([]);
    }
  };

  const handleSelectInstruction = (instructionId: string) => {
    clearActionData();
    updateFormFields(instructionId);
  };

  const addContent = (type: "text" | "image" | "video") => {
    const newItem: InstructionContentWithKey = {
      type,
      content: "",
      _key: `content-${Date.now()}-${Math.random()}`,
    };
    setExplanation([...explanation, newItem]);
  };

  const updateContent = (index: number, content: string) => {
    const updated = [...explanation];
    updated[index].content = content;
    setExplanation(updated);
  };

  const removeContent = (index: number) => {
    setExplanation(explanation.filter((_, i) => i !== index));
    if (selectedContentIndex === index) {
      setSelectedContentIndex(null);
    } else if (selectedContentIndex !== null && selectedContentIndex > index) {
      setSelectedContentIndex(selectedContentIndex - 1);
    }
  };

  const moveContentUp = () => {
    if (selectedContentIndex === null || selectedContentIndex === 0) return;
    const updated = [...explanation];
    [updated[selectedContentIndex - 1], updated[selectedContentIndex]] = [
      updated[selectedContentIndex],
      updated[selectedContentIndex - 1],
    ];
    setExplanation(updated);
    setSelectedContentIndex(selectedContentIndex - 1);
  };

  const moveContentDown = () => {
    if (selectedContentIndex === null || selectedContentIndex >= explanation.length - 1) return;
    const updated = [...explanation];
    [updated[selectedContentIndex], updated[selectedContentIndex + 1]] = [
      updated[selectedContentIndex + 1],
      updated[selectedContentIndex],
    ];
    setExplanation(updated);
    setSelectedContentIndex(selectedContentIndex + 1);
  };

  const generateCode = () => {
    // Remove internal _key property before generating code
    const cleanExplanation: InstructionContent[] = explanation.map(({ _key, ...item }) => item);

    const instruction: Instruction = {
      id,
      title,
      ...(description && { description }),
      status,
      explanation: cleanExplanation,
      ...(type === "link" && { type, missionId }),
    };

    return JSON.stringify(instruction, null, 2);
  };

  const handleTranslateAndSwitch = async () => {
    if (!title) {
      alert("Please fill in at least the title before translating");
      return;
    }

    setIsTranslating(true);

    try {
      const sourceLang = language === "en" ? "en" : "he";
      const targetLang = language === "en" ? "he" : "en";

      const textsToTranslate = [
        title,
        description || "",
        ...explanation.filter((e) => e.type === "text").map((e) => e.content),
      ].filter(Boolean);

      const translationPromises = textsToTranslate.map(async (text) => {
        const formData = new FormData();
        formData.append("actionType", "translate");
        formData.append("text", text);
        formData.append("sourceLang", sourceLang);
        formData.append("targetLang", targetLang);

        const response = await fetch("/admin", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Translation failed");
        }
        return result.translatedText;
      });

      const translations = await Promise.all(translationPromises);

      let index = 0;
      const translatedTitle = translations[index++];
      const translatedDescription = description ? translations[index++] : "";

      const translatedExplanation = explanation.map((item) => {
        if (item.type === "text" && item.content) {
          return { ...item, content: translations[index++] };
        }
        return item;
      });

      setTitle(translatedTitle);
      setDescription(translatedDescription);
      setExplanation(translatedExplanation);

      alert(`Translation successful! Fields updated to ${targetLang === "he" ? "Hebrew" : "English"}`);

      window.location.href = `/admin?tab=edit-instruction&lang=${targetLang}`;
    } catch (error) {
      console.error("Translation error:", error);
      alert(`Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Track if there are unsaved changes
  const hasUnsavedChanges = selectedInstructionId && originalCode !== "" && generateCode() !== originalCode;

  // Get missions that include the selected instruction
  const getMissionsForInstruction = (instructionId: string) => {
    return missions.filter((mission) => mission.instructions?.some(([id]) => id === instructionId));
  };

  const selectedInstructionMissions = selectedInstructionId ? getMissionsForInstruction(selectedInstructionId) : [];

  return (
    <div>
      {/* Replace Instruction Dialog */}
      {showReplaceDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowReplaceDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Replace Instruction</h2>
              <button className={styles.dialogClose} onClick={() => setShowReplaceDialog(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "var(--space-4)" }}>
              <p style={{ marginBottom: "var(--space-3)", color: "var(--color-neutral-11)" }}>
                Replace instruction <strong>{selectedInstructionId}</strong> with another instruction in all missions
                that use it.
              </p>
              <div className={styles.formGroup}>
                <label className={styles.label}>New Instruction ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={replacementInstructionId}
                  onChange={(e) => setReplacementInstructionId(e.target.value)}
                  placeholder="Enter instruction ID (e.g., 42)"
                  autoFocus
                />
              </div>
              {selectedInstructionMissions.length > 0 && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-2)" }}>
                    This instruction is used in {selectedInstructionMissions.length} mission(s):
                  </p>
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      padding: "var(--space-2)",
                      background: "var(--color-neutral-3)",
                      borderRadius: "var(--radius-2)",
                      border: "1px solid var(--color-neutral-6)",
                    }}
                  >
                    {selectedInstructionMissions.map((mission) => (
                      <div
                        key={mission.id}
                        style={{
                          fontSize: "0.75rem",
                          padding: "var(--space-1)",
                          borderBottom: "1px solid var(--color-neutral-4)",
                        }}
                      >
                        {mission.id} - {mission.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-4)",
                  justifyContent: "flex-end",
                }}
              >
                <button type="button" onClick={() => setShowReplaceDialog(false)} className={styles.addButton}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReplaceInstruction}
                  className={styles.submitButton}
                  disabled={!replacementInstructionId.trim() || replaceInstructionFetcher.state !== "idle"}
                >
                  {replaceInstructionFetcher.state !== "idle" ? "Replacing..." : "Replace"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.formSection}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-3)",
          }}
        >
          <h2 className={styles.sectionTitle} style={{ color: hasUnsavedChanges ? "red" : "var(--color-neutral-12)" }}>
            Select Instruction to Edit
          </h2>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={handleDeleteInstruction}
              className={styles.removeButton}
              disabled={!selectedInstructionId || deleteInstructionFetcher.state !== "idle" || !session}
            >
              {deleteInstructionFetcher.state !== "idle" ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowReplaceDialog(true)}
              className={styles.addButton}
              disabled={!selectedInstructionId || !session}
            >
              Replace Instruction
            </button>
            <button
              type="button"
              onClick={handleAddNewInstruction}
              className={styles.addButton}
              disabled={fetcher.state !== "idle" || !session}
            >
              {fetcher.state !== "idle" ? "Creating..." : "+ Add New Instruction"}
            </button>
          </div>
        </div>
        {/* Filter controls */}
        <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <input
            type="text"
            className={styles.input}
            value={instructionFilterEdit}
            onChange={(e) => setInstructionFilterEdit(e.target.value)}
            placeholder="Filter by ID or title..."
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => setInstructionFilterEdit("")}
            className={styles.addButton}
            disabled={!instructionFilterEdit}
            style={{ minWidth: "80px" }}
          >
            Clear
          </button>
        </div>
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
          {/* Left list - Instructions */}
          <div style={{ flex: 1, maxWidth: "400px" }}>
            <div className={styles.instructionCheckboxList}>
              {allInstructionIds
                .filter((id) => {
                  if (!instructionFilterEdit.trim()) return true;
                  const searchTerm = instructionFilterEdit.toLowerCase().trim();
                  const instruction = instructions.find((i) => i.id === id);
                  const idMatch = id.toLowerCase().includes(searchTerm);
                  const titleMatch = instruction?.title?.toLowerCase().includes(searchTerm) || false;
                  return idMatch || titleMatch;
                })
                .map((id) => {
                  const instruction = instructions.find((i) => i.id === id);
                  return (
                    <label key={id} className={styles.checkboxLabel} style={{ cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="instruction"
                        value={id}
                        checked={selectedInstructionId === id}
                        onChange={() => handleSelectInstruction(id)}
                      />
                      <span>
                        {id}
                        {instruction ? ` - ${instruction.title}` : " (No data for this language)"}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>

          {/* Right panel - Missions using this instruction */}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              {selectedInstructionId ? "Missions using this instruction" : "Select an instruction to see missions"}
            </h3>
            <div
              style={{
                border: "1px solid var(--color-neutral-6)",
                borderRadius: "var(--radius-2)",
                padding: "var(--space-3)",
                background: "var(--color-neutral-3)",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {selectedInstructionId && selectedInstructionMissions.length === 0 && (
                <p style={{ color: "var(--color-neutral-11)", fontSize: "0.875rem", textAlign: "center" }}>
                  This instruction is not used in any missions
                </p>
              )}
              {selectedInstructionId && selectedInstructionMissions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {selectedInstructionMissions.map((mission) => {
                    const instructionData = mission.instructions?.find(([id]) => id === selectedInstructionId);
                    const hasCustomTitle = instructionData && instructionData[1];
                    return (
                      <div
                        key={mission.id}
                        style={{
                          padding: "var(--space-2)",
                          borderBottom: "1px solid var(--color-neutral-4)",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          // Store the current instruction selection before navigating
                          if (selectedInstructionId) {
                            localStorage.setItem("lastSelectedInstructionId", selectedInstructionId);
                          }
                          onNavigationRequest(() => {
                            window.location.href = `/admin?tab=edit-mission&lang=${language}&missionId=${mission.id}`;
                          });
                        }}
                      >
                        <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-12)", fontWeight: 500 }}>
                          {mission.id} - {mission.title}
                        </div>
                        {hasCustomTitle && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--color-accent-11)",
                              marginTop: "var(--space-1)",
                            }}
                          >
                            Custom title: "{instructionData[1]}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedInstructionId && (
        <>
          <div className={styles.formSection}>
            <h2
              className={styles.sectionTitle}
              style={{ color: hasUnsavedChanges ? "red" : "var(--color-neutral-12)" }}
            >
              Instruction Details
            </h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Instruction ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g., 9"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Title.  (Can be used as admin comment to identify the instruction. we can set the title for end user
                  in the mission  by rename)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Getting Started with Advanced Features"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Description (to be shown to the end user under  the renamed title before he click the instruction)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Brief description of the instruction"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Instruction Type</label>
                <select
                  className={styles.input}
                  value={type}
                  onChange={(e) => setType(e.target.value as "default" | "link")}
                >
                  <option value="default">Default (Standard Instruction)</option>
                  <option value="link">Link (Navigate to Another Mission)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Instruction Status</label>
                <select
                  className={styles.input}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "only title" | "partial explanation" | "full explanation")
                  }
                >
                  <option value="only title">Only Title</option>
                  <option value="partial explanation">Partial Explanation</option>
                  <option value="full explanation">Full Explanation</option>
                </select>
              </div>

              {type === "link" && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Target Mission</label>
                  <select className={styles.input} value={missionId} onChange={(e) => setMissionId(e.target.value)}>
                    <option value="">Select a mission...</option>
                    {allMissionIds.map((id) => {
                      const missionData = missions.find((m) => m.id === id);
                      return (
                        <option key={id} value={id}>
                          {id}
                          {missionData ? ` - ${missionData.title}` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <small
                    style={{ color: "var(--color-neutral-11)", fontSize: "0.875rem", marginTop: "var(--space-1)" }}
                  >
                    The mission to navigate to when this instruction is clicked
                  </small>
                </div>
              )}
            </div>
          </div>

          {type === "default" && (
            <div className={styles.formSection}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-3)",
                }}
              >
                <h2
                  className={styles.sectionTitle}
                  style={{ color: hasUnsavedChanges ? "red" : "var(--color-neutral-12)", marginBottom: 0 }}
                >
                  Explanation Content
                </h2>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    type="button"
                    onClick={moveContentUp}
                    className={styles.addButton}
                    disabled={selectedContentIndex === null || selectedContentIndex === 0}
                    title="Move selected content up"
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={moveContentDown}
                    className={styles.addButton}
                    disabled={selectedContentIndex === null || selectedContentIndex >= explanation.length - 1}
                    title="Move selected content down"
                  >
                    ↓ Down
                  </button>
                </div>
              </div>

              {explanation.map((item, index) => (
                <ExplanationContentItem
                  key={item._key || `fallback-${index}`}
                  item={item}
                  index={index}
                  onUpdate={updateContent}
                  onRemove={removeContent}
                  isSelected={selectedContentIndex === index}
                  onSelect={setSelectedContentIndex}
                  instructions={instructions}
                  instructionsEn={instructionsEn}
                  instructionsHe={instructionsHe}
                  onNavigationRequest={onNavigationRequest}
                />
              ))}

              <div className={styles.addContentButtons}>
                <button className={styles.addButton} onClick={() => addContent("text")}>
                  + Add Text
                </button>
                <button className={styles.addButton} onClick={() => addContent("image")}>
                  + Add Image
                </button>
                <button className={styles.addButton} onClick={() => addContent("video")}>
                  + Add Video
                </button>
              </div>
            </div>
          )}

          <div className={styles.previewSection}>
            <h2
              className={styles.previewTitle}
              style={{ color: hasUnsavedChanges ? "red" : "var(--color-neutral-12)" }}
            >
              Updated Code
            </h2>
            <textarea
              className={styles.codeEditor}
              value={generateCode()}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  // Update form fields from the edited JSON
                  setId(parsed.id || "");
                  setTitle(parsed.title || "");
                  setDescription(parsed.description || "");
                  setType(parsed.type || "default");
                  setStatus(parsed.status || "only title");
                  setMissionId(parsed.missionId || "");
                  // Handle explanation with unique keys
                  const explanationWithKeys: InstructionContentWithKey[] = (parsed.explanation || []).map(
                    (item: InstructionContent, idx: number) => ({
                      ...item,
                      _key: `content-${Date.now()}-${idx}-${Math.random()}`,
                    }),
                  );
                  setExplanation(explanationWithKeys);
                } catch (err) {
                  // Invalid JSON - don't update
                }
              }}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: "400px",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                border: "1px solid var(--color-neutral-6)",
                borderRadius: "var(--radius-2)",
                backgroundColor: "var(--color-neutral-2)",
                color: "var(--color-neutral-12)",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={handleTranslateAndSwitch}
                className={styles.addButton}
                disabled={isTranslating || !title}
                style={{ flex: 1 }}
              >
                {isTranslating ? "Translating..." : `Translate to ${language === "en" ? "Hebrew" : "English"} & Switch`}
              </button>
            </div>

            <AuthenticatedForm
              actionType="saveInstruction"
              id={id}
              data={generateCode()}
              disabled={!id || !title}
              language={language}
            />

            {actionData?.success && actionData.message && (
              <div className={styles.successMessage} style={{ marginTop: "var(--space-3)" }}>
                {actionData.message}
              </div>
            )}
            {actionData?.error && (
              <div className={styles.errorMessage} style={{ marginTop: "var(--space-3)" }}>
                {actionData.error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EditMissionForm({
  actionData,
  clearActionData,
  instructions,
  missions,
  allMissionIds,
  instructionsEn,
  instructionsHe,
  language,
  onChangesDetected,
  onNavigationRequest,
}: {
  actionData?: {
    success: boolean;
    message?: string;
    error?: string;
    imageUrl?: string;
    translatedText?: string | null;
    newMissionId?: string;
  };
  clearActionData: () => void;
  instructions: Instruction[];
  missions: Mission[];
  allMissionIds: string[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
}) {
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Hide" | "For all" | "Only Adama" | "Only Bazn">("For all");
  const [selectedInstructions, setSelectedInstructions] = useState<Array<[string, string?]>>([]);
  const [selectedAvailableInstructions, setSelectedAvailableInstructions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const { session } = useAuth();
  const [originalCode, setOriginalCode] = useState("");
  const [searchParams] = useSearchParams();
  const missionFetcher = useFetcher<typeof action>();
  const instructionFetcher = useFetcher<typeof action>();
  const deleteMissionFetcher = useFetcher<typeof action>();
  const [showNewInstructionDialog, setShowNewInstructionDialog] = useState(false);
  const [newInstructionTitle, setNewInstructionTitle] = useState("");
  const [selectedMissionInstruction, setSelectedMissionInstruction] = useState<string | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameInstructionId, setRenameInstructionId] = useState<string | null>(null);
  const [alternativeTitle, setAlternativeTitle] = useState("");
  const [instructionFilter, setInstructionFilter] = useState("");
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Track changes
  useEffect(() => {
    if (selectedMissionId) {
      const currentCode = generateCode();
      if (originalCode === "") {
        setOriginalCode(currentCode);
      } else {
        onChangesDetected(currentCode !== originalCode);
      }
    }
  }, [id, title, description, status, selectedInstructions, selectedMissionId]);

  // Reset on save or mission change
  useEffect(() => {
    if (actionData?.success || selectedMissionId) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
  }, [actionData, selectedMissionId]);

  // Handle newly created mission or URL parameter
  useEffect(() => {
    const missionIdFromUrl = searchParams.get("missionId");
    if (missionIdFromUrl && allMissionIds.includes(missionIdFromUrl) && selectedMissionId !== missionIdFromUrl) {
      updateMissionFormFields(missionIdFromUrl);
    }
  }, [searchParams, allMissionIds, selectedMissionId]);

  // Handle scroll to instructions section if flag is set
  useEffect(() => {
    const shouldScroll = localStorage.getItem("scrollToInstructions");
    if (shouldScroll === "true" && selectedMissionId) {
      // Clear the flag
      localStorage.removeItem("scrollToInstructions");
      // Scroll to the section after a brief delay to ensure DOM is ready
      setTimeout(() => {
        const sectionTitle = Array.from(document.querySelectorAll("h2")).find((el) =>
          el.textContent?.includes("Select Instructions by Arrow"),
        );
        if (sectionTitle) {
          sectionTitle.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    }
  }, [selectedMissionId]);

  const handleAddNewInstruction = () => {
    onNavigationRequest(() => {
      // Get all instruction IDs from the instructions prop
      const allIds = instructions.map((i) => i.id);
      const numericIds = allIds.map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);

      // Create the new instruction via fetcher
      const formData = new FormData();
      formData.append("actionType", "createInstruction");
      formData.append("newId", newId);
      formData.append("language", language);
      formData.append("accessToken", session?.access_token || "");

      instructionFetcher.submit(formData, { method: "post" });
    });
  };

  const handleCreateAndAddInstruction = () => {
    if (!newInstructionTitle.trim()) {
      alert("Please enter a title for the new instruction");
      return;
    }

    // Get all instruction IDs from the instructions prop
    const allIds = instructions.map((i) => i.id);
    const numericIds = allIds.map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const newId = String(maxId + 1);

    // Create the new instruction object with the title
    const newInstruction = {
      id: newId,
      title: newInstructionTitle.trim(),
      explanation: [],
    };

    // Create updated mission with the new instruction added
    const updatedInstructions = [...selectedInstructions, [newId]];
    const updatedMission = {
      id,
      title,
      description,
      instructions: updatedInstructions,
    };

    // First save the instruction
    const instructionFormData = new FormData();
    instructionFormData.append("actionType", "saveInstruction");
    instructionFormData.append("id", newId);
    instructionFormData.append("dataEn", JSON.stringify(newInstruction));
    instructionFormData.append("language", language);
    instructionFormData.append("accessToken", session?.access_token || "");

    // Store mission data to save after instruction creation
    (window as any).__pendingMissionUpdate = {
      missionId: selectedMissionId,
      missionData: JSON.stringify(updatedMission),
      language,
      accessToken: session?.access_token || "",
    };

    instructionFetcher.submit(instructionFormData, { method: "post" });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) {
      alert("Please enter a comment");
      return;
    }

    // Generate unique comment ID using timestamp and random number
    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Insert comment after the selected instruction (or at the end if none selected)
    let updatedInstructions: Array<[string, string?]>;

    if (selectedMissionInstruction) {
      // Find the index of the selected instruction
      const selectedIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);

      if (selectedIndex !== -1) {
        // Insert comment after the selected instruction
        updatedInstructions = [
          ...selectedInstructions.slice(0, selectedIndex + 1),
          [commentId, commentText.trim()],
          ...selectedInstructions.slice(selectedIndex + 1),
        ];
      } else {
        // If selected instruction not found, add at the end
        updatedInstructions = [...selectedInstructions, [commentId, commentText.trim()]];
      }
    } else {
      // No instruction selected, add at the end
      updatedInstructions = [...selectedInstructions, [commentId, commentText.trim()]];
    }

    setSelectedInstructions(updatedInstructions);

    // Close dialog and reset
    setShowCommentDialog(false);
    setCommentText("");
  };

  const updateMissionFormFields = (missionId: string) => {
    setSelectedMissionId(missionId);
    // Store the selected mission in localStorage
    localStorage.setItem("lastSelectedMissionId", missionId);
    const mission = missions.find((m) => m.id === missionId);
    if (mission) {
      setId(mission.id);
      setTitle(mission.title);
      setDescription(mission.description);
      setStatus(mission.status || "For all");
      setSelectedInstructions(mission.instructions || []);
    } else {
      // No data for this language, start with empty fields
      setId(missionId);
      setTitle("");
      setDescription("");
      setStatus("For all");
      setSelectedInstructions([]);
    }
  };

  const handleSelectMission = (missionId: string) => {
    clearActionData();
    updateMissionFormFields(missionId);
  };

  const toggleInstruction = (instructionId: string) => {
    const instructionIndex = selectedInstructions.findIndex(([id]) => id === instructionId);
    if (instructionIndex !== -1) {
      setSelectedInstructions(selectedInstructions.filter(([id]) => id !== instructionId));
      if (selectedMissionInstruction === instructionId) {
        setSelectedMissionInstruction(null);
      }
    } else {
      setSelectedInstructions([...selectedInstructions, [instructionId]]);
    }
  };

  const moveInstructionUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedMissionInstruction) return;

    const index = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
    if (index <= 0) return; // Already at the top or not found

    const newOrder = [...selectedInstructions];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSelectedInstructions(newOrder);
  };

  const moveInstructionDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedMissionInstruction) return;

    const index = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
    if (index === -1 || index >= selectedInstructions.length - 1) return; // Already at the bottom or not found

    const newOrder = [...selectedInstructions];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSelectedInstructions(newOrder);
  };

  const generateCode = () => {
    const mission: Mission = {
      id,
      title,
      description,
      instructions: selectedInstructions,
      status,
    };

    return JSON.stringify(mission, null, 2);
  };

  // Watch for mission fetcher completion
  useEffect(() => {
    if (missionFetcher.data && missionFetcher.state === "idle") {
      if (missionFetcher.data.success && missionFetcher.data.newMissionId) {
        // Reload the page to refresh with the new mission selected
        window.location.href = `/admin?tab=edit-mission&lang=${language}&missionId=${missionFetcher.data.newMissionId}`;
      } else if (missionFetcher.data.error) {
        alert(`Failed to create mission: ${missionFetcher.data.error}`);
      }
    }
  }, [missionFetcher.data, missionFetcher.state, language]);

  // Watch for delete mission fetcher completion
  useEffect(() => {
    if (deleteMissionFetcher.data && deleteMissionFetcher.state === "idle") {
      if (deleteMissionFetcher.data.success) {
        alert(deleteMissionFetcher.data.message || "Mission deleted successfully!");
        // Clear the selected mission and reload the page
        window.location.href = `/admin?tab=edit-mission&lang=${language}`;
      } else if (deleteMissionFetcher.data.error) {
        alert(`Failed to delete mission: ${deleteMissionFetcher.data.error}`);
      }
    }
  }, [deleteMissionFetcher.data, deleteMissionFetcher.state, language]);

  // Watch for instruction fetcher completion
  useEffect(() => {
    if (instructionFetcher.data && instructionFetcher.state === "idle") {
      if (instructionFetcher.data.success) {
        // Check if this was a "create and add" operation
        const pendingMissionUpdate = (window as any).__pendingMissionUpdate;
        if (pendingMissionUpdate) {
          // Instruction created successfully, now save the mission with the new instruction
          const missionFormData = new FormData();
          missionFormData.append("actionType", "saveMission");
          missionFormData.append("id", pendingMissionUpdate.missionId);
          missionFormData.append("dataEn", pendingMissionUpdate.missionData);
          missionFormData.append("language", pendingMissionUpdate.language);
          missionFormData.append("accessToken", pendingMissionUpdate.accessToken);

          // Clear the pending data
          delete (window as any).__pendingMissionUpdate;

          // Close the dialog and reset
          setShowNewInstructionDialog(false);
          setNewInstructionTitle("");

          // Submit mission update
          fetch("/admin", {
            method: "POST",
            body: missionFormData,
          }).then(() => {
            // Reload the page to refresh the instruction list
            window.location.href = `/admin?tab=edit-mission&lang=${language}&missionId=${selectedMissionId}`;
          });
        } else if (instructionFetcher.data.newInstructionId) {
          // Regular "add new instruction" from edit-instruction tab
          window.location.href = `/admin?tab=edit-instruction&lang=${language}&instructionId=${instructionFetcher.data.newInstructionId}`;
        }
      } else if (instructionFetcher.data.error) {
        alert(`Failed to create instruction: ${instructionFetcher.data.error}`);
      }
    }
  }, [instructionFetcher.data, instructionFetcher.state, language, selectedMissionId]);

  const handleClearForNewMission = () => {
    onNavigationRequest(() => {
      // Store the current mission before navigating
      if (selectedMissionId) {
        localStorage.setItem("lastSelectedMissionId", selectedMissionId);
      }
      // Create the new mission via fetcher
      const formData = new FormData();
      formData.append("actionType", "createMission");
      formData.append("accessToken", session?.access_token || "");

      missionFetcher.submit(formData, { method: "post" });
    });
  };

  const handleSelectLastMission = () => {
    const lastMissionId = localStorage.getItem("lastSelectedMissionId");
    if (lastMissionId && allMissionIds.includes(lastMissionId)) {
      onNavigationRequest(() => {
        updateMissionFormFields(lastMissionId);
        // Set flag to scroll after page loads
        localStorage.setItem("scrollToInstructions", "true");
        // Update URL to reflect the selection
        window.location.href = `/admin?tab=edit-mission&lang=${language}&missionId=${lastMissionId}`;
      });
    } else {
      alert("No previous mission found or the mission no longer exists");
    }
  };

  const handleDeleteMission = () => {
    if (!selectedMissionId) {
      alert("Please select a mission first");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete mission "${id} - ${title}"?\n\nThis action cannot be undone and will remove the mission from the database.`,
    );

    if (!confirmDelete) {
      return;
    }

    // Create the delete request
    const formData = new FormData();
    formData.append("actionType", "deleteMission");
    formData.append("missionId", selectedMissionId);
    formData.append("accessToken", session?.access_token || "");

    deleteMissionFetcher.submit(formData, { method: "post" });
  };

  // Track if there are unsaved changes
  const hasUnsavedChangesMission = selectedMissionId && originalCode !== "" && generateCode() !== originalCode;

  const handleTranslateAndSwitch = async () => {
    if (!title || !description) {
      alert("Please fill in the title and description before translating");
      return;
    }

    setIsTranslating(true);

    try {
      const sourceLang = language === "en" ? "en" : "he";
      const targetLang = language === "en" ? "he" : "en";

      const titleFormData = new FormData();
      titleFormData.append("actionType", "translate");
      titleFormData.append("text", title);
      titleFormData.append("sourceLang", sourceLang);
      titleFormData.append("targetLang", targetLang);

      const titleResponse = await fetch("/admin", {
        method: "POST",
        body: titleFormData,
      });
      const titleResult = await titleResponse.json();

      if (!titleResult.success) {
        throw new Error(titleResult.error || "Title translation failed");
      }

      const descFormData = new FormData();
      descFormData.append("actionType", "translate");
      descFormData.append("text", description);
      descFormData.append("sourceLang", sourceLang);
      descFormData.append("targetLang", targetLang);

      const descResponse = await fetch("/admin", {
        method: "POST",
        body: descFormData,
      });
      const descResult = await descResponse.json();

      if (!descResult.success) {
        throw new Error(descResult.error || "Description translation failed");
      }

      setTitle(titleResult.translatedText);
      setDescription(descResult.translatedText);

      alert(`Translation successful! Fields updated to ${targetLang === "he" ? "Hebrew" : "English"}`);

      window.location.href = `/admin?tab=edit-mission&lang=${targetLang}`;
    } catch (error) {
      console.error("Translation error:", error);
      alert(`Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Track if there are unsaved changes
  const hasUnsavedChanges = selectedMissionId && originalCode !== "" && generateCode() !== originalCode;

  return (
    <div className={styles.div4}>
      <div className={styles.formSection}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-3)",
          }}
        >
          <h2
            className={styles.sectionTitle}
            style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)" }}
          >
            Select Mission to Edit
          </h2>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={handleDeleteMission}
              className={styles.removeButton}
              disabled={!selectedMissionId || deleteMissionFetcher.state !== "idle" || !session}
            >
              {deleteMissionFetcher.state !== "idle" ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={handleSelectLastMission}
              className={styles.addButton}
              disabled={!localStorage.getItem("lastSelectedMissionId")}
            >
              Select Last Mission
            </button>
            <button
              type="button"
              onClick={handleClearForNewMission}
              className={styles.addButton}
              disabled={missionFetcher.state !== "idle" || !session}
            >
              {missionFetcher.state !== "idle" ? "Creating..." : "+ Create New Mission"}
            </button>
          </div>
        </div>
        <select
          className={styles.input}
          value={selectedMissionId}
          onChange={(e) => handleSelectMission(e.target.value)}
        >
          <option value="">Select a mission...</option>
          {allMissionIds.map((id) => {
            const mission = missions.find((m) => m.id === id);
            const isHidden = mission?.status === "Hide";
            return (
              <option key={id} value={id}>
                {isHidden && "🔴 "}
                {id}
                {mission ? ` - ${mission.title}` : " (No data for this language)"}
              </option>
            );
          })}
        </select>
      </div>

      {selectedMissionId && (
        <>
          <div className={styles.formSection}>
            <h2
              className={styles.sectionTitle}
              style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)" }}
            >
              Mission Details
            </h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Mission ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g., security-basics"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Title</label>
                <input
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Security Fundamentals"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Description</label>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter mission description..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Mission Status</label>
                <select
                  className={styles.input}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Hide" | "For all" | "Only Adama" | "Only Bazn")}
                >
                  <option value="Hide">Hide</option>
                  <option value="For all">For all</option>
                  <option value="Only Adama">Only Adama</option>
                  <option value="Only Bazn">Only Bazn</option>
                </select>
              </div>
            </div>
          </div>

          {/* Select Instructions by Arrow */}
          <div className={styles.formSection}>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <h2
                className={styles.sectionTitle}
                style={{
                  color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Select Instructions
              </h2>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-accent-11)",
                  fontWeight: 500,
                  padding: "var(--space-2)",
                  background: "var(--color-accent-3)",
                  borderRadius: "var(--radius-2)",
                  border: "1px solid var(--color-accent-6)",
                }}
              >
                Current Mission: {id} - {title || "(Untitled)"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
              {/* Left list - Available instructions */}
              <div style={{ flex: 1 }} className={styles.div3}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Available Instructions</h3>
                </div>
                {/* Filter controls */}
                <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  <input
                    type="text"
                    className={styles.input}
                    value={instructionFilter}
                    onChange={(e) => setInstructionFilter(e.target.value)}
                    placeholder="Filter by title or description..."
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setInstructionFilter("")}
                    className={styles.addButton}
                    disabled={!instructionFilter}
                    style={{ minWidth: "80px" }}
                  >
                    Clear
                  </button>
                </div>
                <div
                  style={{
                    border: "1px solid var(--color-neutral-6)",
                    borderRadius: "var(--radius-2)",
                    padding: "var(--space-2)",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {instructions
                    .filter((instruction) => !selectedInstructions.some(([id]) => id === instruction.id))
                    .filter((instruction) => {
                      if (!instructionFilter.trim()) return true;
                      const searchTerm = instructionFilter.toLowerCase().trim();
                      const title = instruction.title?.toLowerCase() || "";
                      const description = instruction.description?.toLowerCase() || "";
                      return title.includes(searchTerm) || description.includes(searchTerm);
                    })
                    .map((instruction) => (
                      <label
                        key={instruction.id}
                        className={styles.checkboxLabel}
                        style={{
                          padding: "var(--space-2)",
                          borderBottom: "1px solid var(--color-neutral-4)",
                          margin: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAvailableInstructions.includes(instruction.id)}
                          onChange={() => {
                            if (selectedAvailableInstructions.includes(instruction.id)) {
                              setSelectedAvailableInstructions(
                                selectedAvailableInstructions.filter((id) => id !== instruction.id),
                              );
                            } else {
                              setSelectedAvailableInstructions([...selectedAvailableInstructions, instruction.id]);
                            }
                          }}
                        />
                        <span>
                          {instruction.id} - {instruction.title}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Center buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }} className={styles.div2}>
                <button
                  type="button"
                  onClick={() => {
                    // Add selected available instructions to the mission
                    // If there's a selected mission instruction, insert above it; otherwise append
                    let newInstructions;
                    if (selectedMissionInstruction) {
                      const insertIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
                      newInstructions = [
                        ...selectedInstructions.slice(0, insertIndex),
                        ...selectedAvailableInstructions.map((id) => [id] as [string, string?]),
                        ...selectedInstructions.slice(insertIndex),
                      ];
                    } else {
                      newInstructions = [
                        ...selectedInstructions,
                        ...selectedAvailableInstructions.map((id) => [id] as [string, string?]),
                      ];
                    }
                    setSelectedInstructions(newInstructions);
                    setSelectedAvailableInstructions([]);
                  }}
                  className={styles.addButton}
                  style={{ width: "80px" }}
                  disabled={selectedAvailableInstructions.length === 0}
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMissionInstruction) {
                      // Remove from selected instructions
                      setSelectedInstructions(selectedInstructions.filter(([id]) => id !== selectedMissionInstruction));
                      setSelectedMissionInstruction(null);
                    }
                  }}
                  className={styles.addButton}
                  style={{ width: "80px" }}
                  disabled={!selectedMissionInstruction}
                >
                  ←
                </button>
              </div>

              {/* Right list - Mission Instructions */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Mission Instructions</h3>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      onClick={() => setShowCommentDialog(true)}
                      className={styles.addButton}
                      disabled={!selectedMissionId || !session}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      💬 Comment
                    </button>
                    <button
                      type="button"
                      onClick={moveInstructionUp}
                      className={styles.addButton}
                      disabled={
                        !selectedMissionInstruction ||
                        selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction) === 0
                      }
                      title="Move selected instruction up"
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      onClick={moveInstructionDown}
                      className={styles.addButton}
                      disabled={
                        !selectedMissionInstruction ||
                        selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction) ===
                          selectedInstructions.length - 1
                      }
                      title="Move selected instruction down"
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      ↓ Down
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMissionInstruction) {
                          // Store the current mission before navigating
                          if (selectedMissionId) {
                            localStorage.setItem("lastSelectedMissionId", selectedMissionId);
                          }
                          onNavigationRequest(() => {
                            window.location.href = `/admin?tab=edit-instruction&lang=${language}&instructionId=${selectedMissionInstruction}`;
                          });
                        } else {
                          alert("Please select an instruction from the list using the radio button first");
                        }
                      }}
                      className={styles.addButton}
                      disabled={!selectedMissionInstruction}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewInstructionDialog(true)}
                      className={styles.addButton}
                      disabled={!selectedMissionId || !session}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      + New
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMissionInstruction) {
                          const instructionData = selectedInstructions.find(
                            ([id]) => id === selectedMissionInstruction,
                          );
                          const currentAltTitle = instructionData?.[1] || "";
                          setRenameInstructionId(selectedMissionInstruction);
                          setAlternativeTitle(currentAltTitle);
                          setShowRenameDialog(true);
                        } else {
                          alert("Please select an instruction from the list using the radio button first");
                        }
                      }}
                      className={styles.addButton}
                      disabled={!selectedMissionInstruction}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      Rename
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    border: "1px solid var(--color-neutral-6)",
                    borderRadius: "var(--radius-2)",
                    padding: "var(--space-2)",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {selectedInstructions.map(([instructionId, customTitle]) => {
                    // Handle comments (ID starts with "comment-" or is "0" for legacy comments) differently - they don't have a matching instruction
                    const isComment = instructionId.startsWith("comment-") || instructionId === "0";
                    const instruction = !isComment ? instructions.find((i) => i.id === instructionId) : null;
                    const hasFullExplanation = instruction?.status === "full explanation";

                    // Skip rendering if it's not a comment and instruction doesn't exist
                    if (!isComment && !instruction) return null;

                    // For comments, display the custom title (which contains the comment text)
                    // For regular instructions, display custom title if present, otherwise instruction title
                    const displayTitle = isComment ? customTitle : customTitle || instruction?.title || "";
                    return (
                      <label
                        key={instructionId}
                        className={styles.checkboxLabel}
                        style={{
                          padding: "var(--space-2)",
                          borderBottom: "1px solid var(--color-neutral-4)",
                          margin: 0,
                        }}
                      >
                        <input
                          type="radio"
                          name="missionInstructionRadio"
                          checked={selectedMissionInstruction === instructionId}
                          onChange={() => setSelectedMissionInstruction(instructionId)}
                        />
                        <span>
                          {/* Show comment indicator for ID "0", otherwise show instruction ID */}
                          {isComment ? (
                            <span style={{ color: "var(--color-accent-11)", fontStyle: "italic" }}>💬 Comment:</span>
                          ) : (
                            <span style={{ color: instruction?.status === "full explanation" ? "green" : "inherit" }}>
                              {instructionId}
                            </span>
                          )}
                          {!isComment && " - "}
                          {displayTitle}
                          {!isComment && customTitle && (
                            <span
                              style={{
                                color: "var(--color-accent-11)",
                                fontSize: "0.875rem",
                                marginLeft: "var(--space-2)",
                              }}
                            >
                              {/* For comments, don't show original title since there isn't one */}
                              {!isComment && instruction && `(${instruction.title})`}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.previewSection}>
            <h2
              className={styles.previewTitle}
              style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)" }}
            >
              Updated Code
            </h2>
            <textarea
              className={styles.codeEditor}
              value={generateCode()}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  // Update form fields from the edited JSON
                  setId(parsed.id || "");
                  setTitle(parsed.title || "");
                  setDescription(parsed.description || "");
                  setStatus(parsed.status || "For all");
                  setSelectedInstructions(parsed.instructions || []);
                } catch (err) {
                  // Invalid JSON - don't update
                }
              }}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: "400px",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                border: "1px solid var(--color-neutral-6)",
                borderRadius: "var(--radius-2)",
                backgroundColor: "var(--color-neutral-2)",
                color: "var(--color-neutral-12)",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={handleTranslateAndSwitch}
                className={styles.addButton}
                disabled={isTranslating || !title || !description}
                style={{ flex: 1 }}
              >
                {isTranslating ? "Translating..." : `Translate to ${language === "en" ? "Hebrew" : "English"} & Switch`}
              </button>
            </div>

            <AuthenticatedForm
              actionType="saveMission"
              id={id}
              data={generateCode()}
              disabled={!id || !title}
              language={language}
            />

            {actionData?.success && actionData.message && (
              <div className={styles.successMessage} style={{ marginTop: "var(--space-3)" }}>
                {actionData.message}
              </div>
            )}
            {actionData?.error && (
              <div className={styles.errorMessage} style={{ marginTop: "var(--space-3)" }}>
                {actionData.error}
              </div>
            )}
          </div>
        </>
      )}

      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowCommentDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Add Comment</h2>
              <button className={styles.dialogClose} onClick={() => setShowCommentDialog(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "var(--space-4)" }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Comment Text</label>
                <input
                  type="text"
                  className={styles.input}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter comment text..."
                  autoFocus
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  justifyContent: "flex-end",
                  marginTop: "var(--space-4)",
                }}
              >
                <button type="button" onClick={() => setShowCommentDialog(false)} className={styles.removeButton}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddComment}
                  className={styles.submitButton}
                  disabled={!commentText.trim()}
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Instruction Dialog */}
      {showRenameDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowRenameDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Rename Instruction for This Mission</h2>
              <button className={styles.dialogClose} onClick={() => setShowRenameDialog(false)}>
                ✕
              </button>
            </div>
            <div className={styles.formGroup} style={{ marginTop: "var(--space-4)" }}>
              <label className={styles.label}>Alternative Title (leave empty to use original title)</label>
              <input
                type="text"
                className={styles.input}
                value={alternativeTitle}
                onChange={(e) => setAlternativeTitle(e.target.value)}
                placeholder="Enter alternative title..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => setShowRenameDialog(false)}
                className={styles.removeButton}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (renameInstructionId) {
                    const newInstructions = selectedInstructions.map(([id, title]) => {
                      if (id === renameInstructionId) {
                        return alternativeTitle.trim()
                          ? ([id, alternativeTitle.trim()] as [string, string])
                          : ([id] as [string, string?]);
                      }
                      return [id, title] as [string, string?];
                    });
                    setSelectedInstructions(newInstructions);
                    setShowRenameDialog(false);
                    setRenameInstructionId(null);
                    setAlternativeTitle("");
                  }
                }}
                className={styles.submitButton}
                style={{ flex: 1 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowCommentDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Add Comment to Mission</h2>
              <button className={styles.dialogClose} onClick={() => setShowCommentDialog(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "var(--space-4)" }}>
              <p style={{ marginBottom: "var(--space-3)", color: "var(--color-neutral-11)" }}>
                Add a comment that will appear in the mission's instruction list. Comments are mission-specific and are
                not saved to the instructions table.
              </p>
              <div className={styles.formGroup}>
                <label className={styles.label}>Comment Text</label>
                <textarea
                  className={styles.textarea}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your comment..."
                  rows={3}
                  autoFocus
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-4)",
                  justifyContent: "flex-end",
                }}
              >
                <button type="button" onClick={() => setShowCommentDialog(false)} className={styles.removeButton}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddComment}
                  className={styles.submitButton}
                  disabled={!commentText.trim()}
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Instruction Dialog */}
      {showNewInstructionDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowNewInstructionDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Create New Instruction</h2>
              <button className={styles.dialogClose} onClick={() => setShowNewInstructionDialog(false)}>
                ✕
              </button>
            </div>
            <div className={styles.formGroup} style={{ marginTop: "var(--space-4)" }}>
              <label className={styles.label}>Instruction Title</label>
              <input
                type="text"
                className={styles.input}
                value={newInstructionTitle}
                onChange={(e) => setNewInstructionTitle(e.target.value)}
                placeholder="Enter instruction title..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => setShowNewInstructionDialog(false)}
                className={styles.removeButton}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAndAddInstruction}
                className={styles.submitButton}
                style={{ flex: 1 }}
                disabled={!newInstructionTitle.trim()}
              >
                Create & Add to Mission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
