import type { Route } from "./+types/instructions-with-images";
import { useSearchParams, useFetcher } from "react-router";
import { useState } from "react";
import styles from "./instructions-with-images.module.css";
import { getAllInstructions, getAllInstructionsHe } from "~/services/instructions.server";
import { Checkbox } from "~/components/ui/checkbox/checkbox";
import { uploadImage, listAllImages } from "~/lib/image-upload";
import { useAuth } from "~/hooks/use-auth";
import { useEffect } from "react";
import { AppNavigation } from "~/components/app-navigation/app-navigation";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("imageUrl");

  const [instructions, instructionsHe] = await Promise.all([getAllInstructions(), getAllInstructionsHe()]);

  let initialKeywords: string[] = [];
  if (imageUrl) {
    const marker = "/object/public/mission-images/";
    const idx = imageUrl.indexOf(marker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(imageUrl.slice(idx + marker.length).split("?")[0]);
      const { getKeywordsForPaths } = await import("~/services/image-keywords.server");
      const kwMap = await getKeywordsForPaths([storagePath]);
      initialKeywords = kwMap[storagePath] ?? [];
    }
  }

  return {
    instructions,
    instructionsHe,
    supabaseUrl: process.env.SUPABASE_PROJECT_URL!,
    supabaseKey: process.env.SUPABASE_API_KEY!,
    initialKeywords,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const oldImageUrl = formData.get("oldImageUrl") as string;
  const newImageUrl = formData.get("newImageUrl") as string;
  const selectedInstructionIds = JSON.parse(formData.get("selectedInstructionIds") as string);
  const accessToken = formData.get("accessToken") as string | null;

  if (actionType === "replaceImage") {
    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    if (!oldImageUrl || !newImageUrl) {
      return { success: false, error: "Both old and new image URLs are required" };
    }

    if (selectedInstructionIds.length === 0) {
      return { success: false, error: "Please select at least one instruction" };
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

      // Get all selected instructions
      const { data: instructionsData, error: fetchError } = await supabase
        .from("instructions")
        .select("*")
        .in("id", selectedInstructionIds);

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      let instructionsUpdated = 0;

      // Update each instruction's explanation array
      if (instructionsData && instructionsData.length > 0) {
        const updatePromises = instructionsData.map(async (instructionRow: any) => {
          let updated = false;
          const updatedRow: any = { updated_at: new Date().toISOString() };

          // Check and update data_en
          if (instructionRow.data_en && Array.isArray(instructionRow.data_en.explanation)) {
            const updatedExplanation = instructionRow.data_en.explanation.map((item: any) => {
              if (item.type === "image" && item.content === oldImageUrl) {
                return { ...item, content: newImageUrl };
              }
              return item;
            });
            // Check if anything was actually replaced
            if (JSON.stringify(updatedExplanation) !== JSON.stringify(instructionRow.data_en.explanation)) {
              updatedRow.data_en = {
                ...instructionRow.data_en,
                explanation: updatedExplanation,
              };
              updated = true;
            }
          }

          // Check and update data_he
          if (instructionRow.data_he && Array.isArray(instructionRow.data_he.explanation)) {
            const updatedExplanation = instructionRow.data_he.explanation.map((item: any) => {
              if (item.type === "image" && item.content === oldImageUrl) {
                return { ...item, content: newImageUrl };
              }
              return item;
            });
            // Check if anything was actually replaced
            if (JSON.stringify(updatedExplanation) !== JSON.stringify(instructionRow.data_he.explanation)) {
              updatedRow.data_he = {
                ...instructionRow.data_he,
                explanation: updatedExplanation,
              };
              updated = true;
            }
          }

          // Update the instruction if it was modified
          if (updated) {
            await supabase.from("instructions").update(updatedRow).eq("id", instructionRow.id);
            instructionsUpdated++;
          }
        });

        await Promise.all(updatePromises);
      }

      return {
        success: true,
        message: `Image replaced in ${instructionsUpdated} instruction(s)!`,
        instructionsUpdated,
      };
    } catch (error) {
      console.error("Error in replaceImage:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "renameImage") {
    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    const oldStoragePath = formData.get("oldStoragePath") as string;
    const newName = formData.get("newName") as string;
    const oldImageUrl = formData.get("oldImageUrl") as string;

    if (!oldStoragePath || !newName) {
      return { success: false, error: "Storage path and new name are required" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // Build new path: keep same folder and extension, change filename only
      const pathParts = oldStoragePath.split("/");
      const oldFileName = pathParts[pathParts.length - 1];
      const folder = pathParts.slice(0, -1).join("/");
      const ext = oldFileName.split(".").pop();
      const sanitized = newName
        .trim()
        .replace(/[^a-zA-Z0-9._\-\u0590-\u05FF]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (!sanitized) {
        return { success: false, error: "Invalid file name after sanitization" };
      }

      const newFileName = ext ? `${sanitized}.${ext}` : sanitized;
      const newStoragePath = folder ? `${folder}/${newFileName}` : newFileName;

      // Move (rename) the file in Supabase Storage
      const { error: moveError } = await supabase.storage.from("mission-images").move(oldStoragePath, newStoragePath);

      if (moveError) {
        return { success: false, error: moveError.message };
      }

      // Get the new public URL
      const {
        data: { publicUrl: newImageUrl },
      } = supabase.storage.from("mission-images").getPublicUrl(newStoragePath);

      // Update all instructions referencing the old URL
      const { data: instructionsData, error: fetchError } = await supabase.from("instructions").select("*");

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      let instructionsUpdated = 0;

      if (instructionsData && instructionsData.length > 0) {
        const updatePromises = instructionsData.map(async (instructionRow: any) => {
          let updated = false;
          const updatedRow: any = { updated_at: new Date().toISOString() };

          if (instructionRow.data_en && Array.isArray(instructionRow.data_en.explanation)) {
            const updatedExplanation = instructionRow.data_en.explanation.map((item: any) => {
              if (item.type === "image" && item.content === oldImageUrl) {
                return { ...item, content: newImageUrl };
              }
              return item;
            });
            if (JSON.stringify(updatedExplanation) !== JSON.stringify(instructionRow.data_en.explanation)) {
              updatedRow.data_en = { ...instructionRow.data_en, explanation: updatedExplanation };
              updated = true;
            }
          }

          if (instructionRow.data_he && Array.isArray(instructionRow.data_he.explanation)) {
            const updatedExplanation = instructionRow.data_he.explanation.map((item: any) => {
              if (item.type === "image" && item.content === oldImageUrl) {
                return { ...item, content: newImageUrl };
              }
              return item;
            });
            if (JSON.stringify(updatedExplanation) !== JSON.stringify(instructionRow.data_he.explanation)) {
              updatedRow.data_he = { ...instructionRow.data_he, explanation: updatedExplanation };
              updated = true;
            }
          }

          if (updated) {
            await supabase.from("instructions").update(updatedRow).eq("id", instructionRow.id);
            instructionsUpdated++;
          }
        });

        await Promise.all(updatePromises);
      }

      // Update image_keywords entry for the renamed file (non-fatal)
      try {
        const { renameImageKeywords } = await import("~/services/image-keywords.server");
        await renameImageKeywords(oldStoragePath, newStoragePath);
      } catch {
        // Keywords rename failure is non-fatal
      }

      return {
        success: true,
        actionType: "renameImage" as const,
        message: `Image renamed successfully! Updated ${instructionsUpdated} instruction(s).`,
        newImageUrl,
        instructionsUpdated,
      };
    } catch (error) {
      console.error("Error in renameImage:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "updateKeywords") {
    const imagePath = formData.get("imagePath") as string;
    const keywordsRaw = formData.get("keywords") as string;

    if (!imagePath) return { success: false, error: "Image path is required" };

    try {
      const keywords = JSON.parse(keywordsRaw) as string[];
      const { upsertImageKeywords } = await import("~/services/image-keywords.server");
      const result = await upsertImageKeywords(imagePath, keywords);
      return result.success
        ? { success: true, actionType: "updateKeywords" as const, message: "Keywords saved!" }
        : { success: false, error: result.error ?? "Failed to save keywords" };
    } catch {
      return { success: false, error: "Invalid keywords data" };
    }
  }

  return { success: false, error: "Invalid action type" };
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

// Image Library Dialog Component
function ImageLibraryDialog({
  isOpen,
  onClose,
  onSelectImage,
  instructions,
  instructionsHe,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  instructions: any[];
  instructionsHe: any[];
}) {
  const [images, setImages] = useState<Array<{ name: string; url: string; path: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

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
    const allInstructions = [...instructions, ...instructionsHe];
    const found = allInstructions.some((instruction) => {
      // Skip if instruction has no explanation or it's not an array
      if (!instruction.explanation || !Array.isArray(instruction.explanation)) {
        return false;
      }
      return instruction.explanation.some((item: any) => item.type === "image" && item.content === imageUrl);
    });
    // Console log for debugging (will show in browser console)
    if (!found) {
      console.log("Image not found in any instruction:", imageUrl);
      console.log("Total instructions checked:", allInstructions.length);
      const instructionsWithExplanation = allInstructions.filter(
        (i) => i.explanation && Array.isArray(i.explanation) && i.explanation.length > 0,
      );
      console.log("Instructions with explanations:", instructionsWithExplanation.length);
      const allImageUrls = instructionsWithExplanation.flatMap((i) =>
        i.explanation!.filter((e: any) => e.type === "image").map((e: any) => e.content),
      );
      console.log("All image URLs in instructions:", allImageUrls);
    }
    return found;
  };

  // Toggle image selection
  const toggleImageSelection = (imagePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImages((prev) => {
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
      alert("Please select at least one image to delete");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedImages.size} image(s)?\n\nThis action cannot be undone.`,
    );

    if (!confirmDelete) {
      return;
    }

    setIsDeleting(true);
    const { deleteImage } = await import("~/lib/image-upload");

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
      alert(`Deleted ${successCount} image(s).\nFailed to delete ${errorCount} image(s):\n${errors.join("\n")}`);
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
    const handlePrevImage = () => {
      if (currentImageIndex > 0) {
        const prevIndex = currentImageIndex - 1;
        setCurrentImageIndex(prevIndex);
        setPreviewImage({ url: images[prevIndex].url, name: images[prevIndex].name });
      }
    };

    const handleNextImage = () => {
      if (currentImageIndex < images.length - 1) {
        const nextIndex = currentImageIndex + 1;
        setCurrentImageIndex(nextIndex);
        setPreviewImage({ url: images[nextIndex].url, name: images[nextIndex].name });
      }
    };

    return (
      <div className={styles.dialogOverlay} onClick={() => setPreviewImage(null)}>
        <div
          className={styles.dialogContent}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}
        >
          <div className={styles.dialogHeader}>
            <h2 className={styles.dialogTitle}>{previewImage.name}</h2>
            <button className={styles.dialogClose} onClick={() => setPreviewImage(null)}>
              ✕
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-4)",
              background: "var(--color-neutral-2)",
              position: "relative",
            }}
          >
            {/* Previous arrow button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevImage();
              }}
              disabled={currentImageIndex === 0}
              className={styles.imageNavButton}
              style={{
                position: "absolute",
                left: "var(--space-4)",
                top: "50%",
                transform: "translateY(-50%)",
              }}
              title="Previous image"
            >
              ←
            </button>

            <img
              src={previewImage.url}
              alt={previewImage.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "var(--radius-2)" }}
            />

            {/* Next arrow button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextImage();
              }}
              disabled={currentImageIndex === images.length - 1}
              className={styles.imageNavButton}
              style={{
                position: "absolute",
                right: "var(--space-4)",
                top: "50%",
                transform: "translateY(-50%)",
              }}
              title="Next image"
            >
              →
            </button>

            {/* Image counter and Select button */}
            <div
              style={{
                position: "absolute",
                bottom: "var(--space-4)",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "var(--space-3)",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-2)",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                }}
              >
                {currentImageIndex + 1} / {images.length}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectImage(previewImage.url);
                  onClose();
                }}
                className={styles.selectImageButton}
                title="Select this image"
              >
                ✓ Select
              </button>
            </div>
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
            <div
              style={{
                padding: "var(--space-4)",
                borderBottom: "1px solid var(--color-neutral-6)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
                {selectedImages.size > 0 ? `${selectedImages.size} image(s) selected` : "Select images to delete"}
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  onClick={() => {
                    const selectedImagePath = Array.from(selectedImages)[0];
                    const selectedImage = images.find((img) => img.path === selectedImagePath);
                    if (selectedImage) {
                      onSelectImage(selectedImage.url);
                      onClose();
                    }
                  }}
                  className={styles.submitButton}
                  disabled={selectedImages.size !== 1}
                  style={{ minWidth: "100px" }}
                >
                  ✓ Select
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className={styles.deleteButton}
                  disabled={selectedImages.size === 0 || isDeleting}
                  style={{ minWidth: "100px" }}
                >
                  {isDeleting ? "Deleting..." : "Delete Selected"}
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
                      setCurrentImageIndex(images.indexOf(image));
                      setPreviewImage({ url: image.url, name: image.name });
                    }}
                    style={{
                      position: "relative",
                      border: isSelected ? "3px solid var(--color-accent-9)" : undefined,
                      opacity: isUsed ? 1 : 0.6,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "var(--space-2)",
                        left: "var(--space-2)",
                        zIndex: 10,
                      }}
                      onClick={(e) => toggleImageSelection(image.path, e)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: "pointer", width: "18px", height: "18px" }}
                      />
                    </div>
                    {!isUsed && (
                      <div
                        style={{
                          position: "absolute",
                          top: "var(--space-2)",
                          right: "var(--space-2)",
                          background: "var(--color-error-9)",
                          color: "white",
                          padding: "var(--space-1) var(--space-2)",
                          borderRadius: "var(--radius-2)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          zIndex: 5,
                          pointerEvents: "none",
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

/** Extracts the Supabase Storage path from a full public URL */
function getStoragePathFromUrl(url: string): string {
  const marker = "/object/public/mission-images/";
  const idx = url.indexOf(marker);
  return idx !== -1 ? url.slice(idx + marker.length) : "";
}

export default function InstructionsWithImages({ loaderData }: Route.ComponentProps) {
  const { instructions, instructionsHe, supabaseUrl, supabaseKey, initialKeywords } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const imageUrl = searchParams.get("imageUrl");
  const [selectedInstructions, setSelectedInstructions] = useState<Set<string>>(new Set());
  const [newImageUrl, setNewImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showReplaceSection, setShowReplaceSection] = useState(false);
  const [showKeywordsSection, setShowKeywordsSection] = useState(false);
  const [libraryMode, setLibraryMode] = useState<"replace" | "navigate">("replace");
  const [libraryImages, setLibraryImages] = useState<Array<{ name: string; url: string; path: string }>>([]);
  const [libraryImagesLoaded, setLibraryImagesLoaded] = useState(false);
  const { session, loading } = useAuth();
  const fetcher = useFetcher<typeof action>();
  const renameFetcher = useFetcher<typeof action>();
  const keywordsFetcher = useFetcher<typeof action>();
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [keywordInput, setKeywordInput] = useState("");

  // Initialize Supabase on the client
  useEffect(() => {
    const initSupabase = async () => {
      const { initSupabase: init } = await import("~/lib/supabase");
      init(supabaseUrl, supabaseKey);
    };
    initSupabase();
  }, [supabaseUrl, supabaseKey]);

  // Load library images for inline prev/next navigation
  useEffect(() => {
    listAllImages().then((result) => {
      if (!result.error) {
        setLibraryImages(result.images);
      }
      setLibraryImagesLoaded(true);
    });
  }, []);

  // Filter instructions to only show those containing this specific image
  // Note: searchParams.get() automatically decodes the URL, so imageUrl is already decoded
  const filteredInstructions = imageUrl
    ? instructions.filter((instruction) =>
        instruction.explanation?.some((item) => item.type === "image" && item.content === imageUrl),
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

  // Library inline navigation
  const libraryIndex = imageUrl ? libraryImages.findIndex((img) => img.url === imageUrl) : -1;

  const handlePrevLibraryImage = () => {
    if (libraryIndex > 0) {
      setSearchParams({ imageUrl: libraryImages[libraryIndex - 1].url }, { replace: true });
    }
  };

  const handleNextLibraryImage = () => {
    if (libraryIndex < libraryImages.length - 1) {
      setSearchParams({ imageUrl: libraryImages[libraryIndex + 1].url }, { replace: true });
    }
  };

  // Image upload handlers
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
      const permissionStatus = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));

        if (imageType) {
          const blob = await item.getType(imageType);
          const timestamp = Date.now();
          const extension = imageType.split("/")[1] || "png";
          const file = new File([blob], `pasted-image-${timestamp}.${extension}`, { type: blob.type });

          setImageFile(file);

          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result as string);
          };
          reader.readAsDataURL(blob);

          alert(`Image pasted successfully! (${Math.round(blob.size / 1024)}KB)`);
          return;
        }
      }

      const allTypes = clipboardItems.flatMap((item) => item.types).join(", ");
      alert(
        `No image found in clipboard.\n\nAvailable formats: ${allTypes || "none"}\n\nPlease copy an image (right-click on image → Copy Image, or use a screenshot tool).`,
      );
    } catch (error) {
      console.error("Clipboard error details:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("denied") || errorMessage.includes("permission")) {
        alert(
          'Clipboard access denied.\n\nPlease allow clipboard access in your browser settings, or try:\n1. Copy an image using Ctrl+C (or Cmd+C on Mac)\n2. Right-click on an image and select "Copy Image"\n3. Use a screenshot tool and copy to clipboard',
        );
      } else if (errorMessage.includes("not supported")) {
        alert("Clipboard API not supported.\n\nPlease use the file input instead.");
      } else {
        alert(
          `Failed to read clipboard: ${errorMessage}\n\nTry:\n1. Copy an image to clipboard\n2. Make sure you're using a modern browser (Chrome, Edge, Firefox)\n3. If using a screenshot tool, ensure it copies to clipboard`,
        );
      }
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
      setNewImageUrl(result.url);
      alert("Image uploaded successfully!");
    }
  };

  const handleSelectFromLibrary = (url: string) => {
    if (libraryMode === "navigate") {
      setSearchParams({ imageUrl: url });
    } else {
      setImagePreview(url);
      setNewImageUrl(url);
    }
  };

  const handleReplaceImage = () => {
    if (!imageUrl) {
      alert("No original image URL found");
      return;
    }

    if (!newImageUrl && !imagePreview) {
      alert("Please provide a new image URL or upload an image");
      return;
    }

    if (selectedInstructions.size === 0) {
      alert("Please select at least one instruction");
      return;
    }

    if (!session) {
      alert("Please sign in to replace images");
      return;
    }

    const finalNewImageUrl = newImageUrl || imagePreview;

    const confirmReplace = window.confirm(
      `Are you sure you want to replace the image in ${selectedInstructions.size} instruction(s)?\n\nThis action will update the selected instructions with the new image URL.`,
    );

    if (!confirmReplace) {
      return;
    }

    // Submit the replacement request
    const formData = new FormData();
    formData.append("actionType", "replaceImage");
    formData.append("oldImageUrl", imageUrl);
    formData.append("newImageUrl", finalNewImageUrl);
    formData.append("selectedInstructionIds", JSON.stringify(Array.from(selectedInstructions)));
    formData.append("accessToken", session.access_token || "");

    fetcher.submit(formData, { method: "post" });
  };

  // Watch for replace fetcher completion
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      if (fetcher.data.success) {
        alert(fetcher.data.message || "Image replaced successfully!");
        window.location.reload();
      } else if (fetcher.data.error) {
        alert(`Failed to replace image: ${fetcher.data.error}`);
      }
    }
  }, [fetcher.data, fetcher.state]);

  // Watch for rename fetcher completion
  useEffect(() => {
    if (renameFetcher.data && renameFetcher.state === "idle") {
      const data = renameFetcher.data;
      if (data.success && "newImageUrl" in data && data.newImageUrl) {
        alert(data.message || "Image renamed successfully!");
        setIsRenaming(false);
        // Update the URL param to the new image URL
        setSearchParams({ imageUrl: data.newImageUrl });
      } else if (!data.success && "error" in data) {
        alert(`Failed to rename image: ${data.error}`);
      }
    }
  }, [renameFetcher.data, renameFetcher.state, setSearchParams]);

  // Sync keywords when loader re-runs (e.g. after rename changes the URL)
  useEffect(() => {
    setKeywords(loaderData.initialKeywords);
  }, [loaderData.initialKeywords]);

  // Watch for keywords fetcher result
  useEffect(() => {
    if (keywordsFetcher.data && keywordsFetcher.state === "idle") {
      const data = keywordsFetcher.data;
      if (!data.success && "error" in data) {
        alert(`Failed to save keywords: ${data.error}`);
      }
    }
  }, [keywordsFetcher.data, keywordsFetcher.state]);

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed || keywords.includes(trimmed)) {
      setKeywordInput("");
      return;
    }
    setKeywords((prev) => [...prev, trimmed]);
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleSaveKeywords = () => {
    if (!imageUrl) return;
    if (!session) {
      alert("Please sign in to save keywords");
      return;
    }
    const storagePath = getStoragePathFromUrl(imageUrl);
    if (!storagePath) {
      alert("Could not determine storage path for this image");
      return;
    }
    const formData = new FormData();
    formData.append("actionType", "updateKeywords");
    formData.append("imagePath", storagePath);
    formData.append("keywords", JSON.stringify(keywords));
    keywordsFetcher.submit(formData, { method: "post" });
  };

  const handleRenameImage = () => {
    if (!imageUrl) return;
    if (!renameValue.trim()) {
      alert("Please enter a new file name");
      return;
    }
    if (!session) {
      alert("Please sign in to rename images");
      return;
    }

    const storagePath = getStoragePathFromUrl(imageUrl);
    if (!storagePath) {
      alert("Could not determine storage path for this image");
      return;
    }

    const formData = new FormData();
    formData.append("actionType", "renameImage");
    formData.append("oldStoragePath", storagePath);
    formData.append("newName", renameValue.trim());
    formData.append("oldImageUrl", imageUrl);
    formData.append("accessToken", session.access_token || "");

    renameFetcher.submit(formData, { method: "post" });
  };

  return (
    <div className={styles.container}>
      <AppNavigation />
      <div className={styles.content}>
        <header className={styles.header}>
          <p className={styles.subtitle}>
            {imageUrl
              ? `Instructions using this image (${filteredInstructions.length} found)`
              : "Follow these step-by-step instructions to complete your task"}
          </p>
        </header>

        {/* Single picture at the top */}
        <div className={styles.imageContainer}>
          <img src={displayImageUrl} alt="Instructions overview" className={styles.image} />

          {/* Library inline navigation: prev / next / counter / select */}
          {libraryImagesLoaded && imageUrl && libraryIndex >= 0 && libraryImages.length > 1 && (
            <>
              <button
                onClick={handlePrevLibraryImage}
                disabled={libraryIndex === 0}
                className={styles.imageNavButton}
                style={{ position: "absolute", left: "var(--space-4)", top: "50%", transform: "translateY(-50%)" }}
                title="Previous image"
              >
                ←
              </button>
              <button
                onClick={handleNextLibraryImage}
                disabled={libraryIndex === libraryImages.length - 1}
                className={styles.imageNavButton}
                style={{ position: "absolute", right: "var(--space-4)", top: "50%", transform: "translateY(-50%)" }}
                title="Next image"
              >
                →
              </button>
              <div
                style={{
                  position: "absolute",
                  bottom: "var(--space-4)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: "var(--space-3)",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.7)",
                    color: "white",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-2)",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                  }}
                >
                  {libraryIndex + 1} / {libraryImages.length}
                </div>
                <button
                  onClick={() => setSearchParams({ imageUrl: libraryImages[libraryIndex].url })}
                  className={styles.selectImageButton}
                  title="Select this image"
                >
                  ✓ Select
                </button>
              </div>
            </>
          )}
        </div>

        {/* Actions Toolbar */}
        {imageUrl && (
          <div className={styles.actionsToolbar}>
            <button
              type="button"
              onClick={() => {
                setLibraryMode("navigate");
                setShowImageLibrary(true);
              }}
              className={styles.actionBackButton}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isRenaming) {
                  const currentName =
                    imageUrl
                      .split("/")
                      .pop()
                      ?.replace(/\.[^.]+$/, "") ?? "";
                  setRenameValue(currentName);
                }
                setIsRenaming((v) => !v);
              }}
              className={`${styles.actionToggleButton} ${isRenaming ? styles.actionToggleActive : ""}`}
            >
              ✏️ Rename Image
            </button>
            <button
              type="button"
              onClick={() => setShowReplaceSection((v) => !v)}
              className={`${styles.actionToggleButton} ${showReplaceSection ? styles.actionToggleActive : ""}`}
            >
              🔄 Replace Image
            </button>
            <button
              type="button"
              onClick={() => setShowKeywordsSection((v) => !v)}
              className={`${styles.actionToggleButton} ${showKeywordsSection ? styles.actionToggleActive : ""}`}
            >
              🏷️ Keywords
            </button>
          </div>
        )}

        {/* Rename Form (shown when Rename is toggled on) */}
        {imageUrl && isRenaming && (
          <div className={styles.renameFormPanel}>
            <span className={styles.renameLabel}>New name:</span>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={styles.renameInput}
              placeholder="Enter new file name (no extension)..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameImage();
                if (e.key === "Escape") setIsRenaming(false);
              }}
            />
            <button
              type="button"
              onClick={handleRenameImage}
              className={styles.renameConfirmButton}
              disabled={!renameValue.trim() || renameFetcher.state !== "idle"}
            >
              {renameFetcher.state !== "idle" ? "Renaming..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setIsRenaming(false)}
              className={styles.renameCancelButton}
              disabled={renameFetcher.state !== "idle"}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Keywords Section */}
        {imageUrl && showKeywordsSection && (
          <div className={styles.keywordsSection}>
            <div className={styles.keywordsSectionHeader}>
              <span className={styles.keywordsSectionTitle}>
                🏷️ Keywords (module, screen, subforamt, section, functionality)
              </span>
              <button
                type="button"
                onClick={handleSaveKeywords}
                className={styles.keywordSaveButton}
                disabled={!session || keywordsFetcher.state !== "idle"}
              >
                {keywordsFetcher.state !== "idle" ? "Saving..." : "💾 Save Keywords"}
              </button>
            </div>
            <div className={styles.keywordChips}>
              {keywords.map((kw) => (
                <span key={kw} className={styles.keywordChip}>
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className={styles.keywordChipRemove}
                    title={`Remove "${kw}"`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {keywords.length === 0 && <span className={styles.noKeywordsText}>No keywords yet</span>}
            </div>
            <div className={styles.keywordInputRow}>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Add a keyword..."
                className={styles.keywordInput}
              />
              <button
                type="button"
                onClick={addKeyword}
                className={styles.keywordAddButton}
                disabled={!keywordInput.trim()}
              >
                + Add
              </button>
            </div>
          </div>
        )}

        {/* Image Replacement Section */}
        {imageUrl && showReplaceSection && (
          <div className={styles.imageReplacementSection}>
            <h2 className={styles.sectionTitle}>Replace Image</h2>
            <p className={styles.replacementDescription}>
              Upload a new image or paste a URL to replace the current image in the selected instructions below.
            </p>

            <div className={styles.imageUploadControls}>
              <div className={styles.formGroup}>
                <label className={styles.label}>New Image URL</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Enter image URL or upload below..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Upload New Image or Select from Library</label>
                <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  <button type="button" onClick={() => { setLibraryMode("replace"); setShowImageLibrary(true); }} className={styles.libraryButton}>
                    📚 Select from Library
                  </button>
                  <button type="button" onClick={handlePasteFromClipboard} className={styles.pasteButton}>
                    📋 Paste from Clipboard
                  </button>
                </div>
                <input type="file" accept="image/*" onChange={handleImageChange} className={styles.input} />
                {imagePreview && (
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{ maxWidth: "200px", borderRadius: "var(--radius-2)" }}
                    />
                  </div>
                )}
                {imageFile && !isUploading && (
                  <button
                    type="button"
                    onClick={handleImageUpload}
                    className={styles.uploadButton}
                    style={{ marginTop: "var(--space-2)" }}
                  >
                    Upload to Supabase
                  </button>
                )}
                {isUploading && (
                  <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>Uploading...</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleReplaceImage}
                className={styles.replaceButton}
                disabled={
                  loading ||
                  !session ||
                  selectedInstructions.size === 0 ||
                  (!newImageUrl && !imagePreview) ||
                  fetcher.state !== "idle"
                }
              >
                {fetcher.state !== "idle"
                  ? "Replacing..."
                  : `Replace Image in ${selectedInstructions.size} Selected Instruction(s)`}
              </button>

              {!loading && !session && <p className={styles.authWarning}>Please sign in to replace images</p>}
            </div>

          </div>
        )}

        {/* Image Library Dialog — shared between Back navigation and Replace section */}
        <ImageLibraryDialog
          isOpen={showImageLibrary}
          onClose={() => setShowImageLibrary(false)}
          onSelectImage={handleSelectFromLibrary}
          instructions={instructions}
          instructionsHe={instructionsHe}
        />

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
                  {selectedInstructions.size > 0 ? `${selectedInstructions.size} selected` : "Select all"}
                </span>
              </div>
            )}
          </div>
          <div className={styles.instructionCheckboxList}>
            {filteredInstructions.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No instructions use this image.</p>
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
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className={styles.instructionId}>{instruction.id}</span>
                    <span className={styles.instructionTitle}>{instruction.title || "(No title)"}</span>
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
