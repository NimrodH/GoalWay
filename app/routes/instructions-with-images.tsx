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
  const [instructions, instructionsHe] = await Promise.all([getAllInstructions(), getAllInstructionsHe()]);
  return {
    instructions,
    instructionsHe,
    supabaseUrl: process.env.SUPABASE_PROJECT_URL!,
    supabaseKey: process.env.SUPABASE_API_KEY!,
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
            }}
          >
            <img
              src={previewImage.url}
              alt={previewImage.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "var(--radius-2)" }}
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

export default function InstructionsWithImages({ loaderData }: Route.ComponentProps) {
  const { instructions, instructionsHe, supabaseUrl, supabaseKey } = loaderData;
  const [searchParams] = useSearchParams();
  const imageUrl = searchParams.get("imageUrl");
  const [selectedInstructions, setSelectedInstructions] = useState<Set<string>>(new Set());
  const [newImageUrl, setNewImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const { session, loading } = useAuth();
  const fetcher = useFetcher<typeof action>();

  // Initialize Supabase on the client
  useEffect(() => {
    const initSupabase = async () => {
      const { initSupabase: init } = await import("~/lib/supabase");
      init(supabaseUrl, supabaseKey);
    };
    initSupabase();
  }, [supabaseUrl, supabaseKey]);

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
    setImagePreview(url);
    setNewImageUrl(url);
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

  // Watch for fetcher completion
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      if (fetcher.data.success) {
        alert(fetcher.data.message || "Image replaced successfully!");
        // Reload the page to show updated data
        window.location.reload();
      } else if (fetcher.data.error) {
        alert(`Failed to replace image: ${fetcher.data.error}`);
      }
    }
  }, [fetcher.data, fetcher.state]);

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
        </div>

        {/* Image Replacement Section */}
        {imageUrl && (
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
                  <button type="button" onClick={() => setShowImageLibrary(true)} className={styles.libraryButton}>
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

            <ImageLibraryDialog
              isOpen={showImageLibrary}
              onClose={() => setShowImageLibrary(false)}
              onSelectImage={handleSelectFromLibrary}
              instructions={instructions}
              instructionsHe={instructionsHe}
            />
          </div>
        )}

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
