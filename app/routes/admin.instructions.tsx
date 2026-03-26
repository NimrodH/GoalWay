import { useState, useEffect } from "react";
import { useActionData, useLoaderData, useSearchParams, useFetcher } from "react-router";
import classNames from "classnames";
import { AdminLayout } from "~/components/admin-layout/admin-layout";
import { useAuth } from "~/hooks/use-auth";
import { uploadImage, listAllImages } from "~/lib/image-upload";
import type { Instruction, InstructionContent } from "~/services/instructions.server";
import type { Mission } from "~/services/missions.server";
import styles from "./admin.module.css";
import { loader as adminLoader, action as adminAction } from "~/routes/admin";

type InstructionContentWithKey = InstructionContent & { _key?: string };

export const loader = adminLoader;
export const action = adminAction;

export default function AdminInstructionsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AdminLayout loaderData={loaderData} activeSection="instructions">
      {({ onChangesDetected, onNavigationRequest, clearActionData, onRegisterSaveButton }) => (
        <EditInstructionForm
          actionData={actionData}
          clearActionData={clearActionData}
          instructions={loaderData.instructions}
          missions={loaderData.missions}
          allInstructionIds={loaderData.allInstructionIds}
          allMissionIds={loaderData.allMissionIds}
          instructionsEn={loaderData.instructionsEn}
          instructionsHe={loaderData.instructionsHe}
          language={loaderData.language}
          onChangesDetected={onChangesDetected}
          onNavigationRequest={onNavigationRequest}
          adminNotesMap={loaderData.adminNotesMap}
          onRegisterSaveButton={onRegisterSaveButton}
        />
      )}
    </AdminLayout>
  );
}

// Image Library Dialog Component
function ImageLibraryDialog({
  isOpen,
  onClose,
  onSelectImage,
  instructions,
  instructionsEn,
  instructionsHe,
  preSelectImageUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  instructions: Instruction[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  preSelectImageUrl?: string;
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
      // If preSelectImageUrl is provided, open it in preview mode
      if (preSelectImageUrl) {
        const imageName = preSelectImageUrl.split("/").pop() || "Preview";
        setPreviewImage({ url: preSelectImageUrl, name: imageName });
      } else {
        setPreviewImage(null);
      }
    }
  }, [isOpen, preSelectImageUrl]);

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
      return instruction.explanation.some((item) => item.type === "image" && item.content === imageUrl);
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
        i.explanation!.filter((e) => e.type === "image").map((e) => e.content),
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
              className={styles.div13}
            >
              {currentImageIndex + 1} / {images.length}
            </div>
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
            ></div>
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
                  onClick={() => {
                    const selectedImagePath = Array.from(selectedImages)[0];
                    const selectedImage = images.find((img) => img.path === selectedImagePath);
                    if (selectedImage) {
                      window.location.href = `/instructions-with-images?imageUrl=${encodeURIComponent(selectedImage.url)}`;
                    }
                  }}
                  className={styles.addButton}
                  disabled={selectedImages.size !== 1}
                  style={{ minWidth: "180px" }}
                >
                  🔍 View Instructions with Image
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className={styles.removeButton}
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

// Component for individual explanation content items with image upload
function ExplanationContentItem({
  item,
  index,
  onUpdate,
  onRemove,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  instructions,
  instructionsEn,
  instructionsHe,
  onNavigationRequest,
  imageFile,
  onImageFileChange,
}: {
  item: InstructionContentWithKey;
  index: number;
  onUpdate: (index: number, content: string) => void;
  onRemove: (index: number) => void;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  instructions: Instruction[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  onNavigationRequest: (navigationFn: () => void) => void;
  imageFile: File | null;
  onImageFileChange: (index: number, file: File | null, preview: string) => void;
}) {
  const [imagePreview, setImagePreview] = useState<string>(item.type === "image" ? item.content : "");
  const [isUploading, setIsUploading] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setImagePreview(preview);
        onImageFileChange(index, file, preview);
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

              // Create preview
              const reader = new FileReader();
              reader.onloadend = () => {
                const preview = reader.result as string;
                setImagePreview(preview);
                onImageFileChange(index, file, preview);
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

                // Create preview
                const reader = new FileReader();
                reader.onloadend = () => {
                  const preview = reader.result as string;
                  setImagePreview(preview);
                  onImageFileChange(index, file, preview);
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
        const pasteButton = document.querySelector("[data-paste-button]");
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
      onImageFileChange(index, null, result.url);
      alert("Image uploaded successfully!");
    }
  };

  const handleSelectFromLibrary = (url: string) => {
    setImagePreview(url);
    onUpdate(index, url);
    onImageFileChange(index, null, url);
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
        <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => onMoveUp(index)}
            disabled={!canMoveUp}
            title="Move block up"
            style={{ padding: "var(--space-1) var(--space-2)", fontSize: "0.875rem", lineHeight: 1 }}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => onMoveDown(index)}
            disabled={!canMoveDown}
            title="Move block down"
            style={{ padding: "var(--space-1) var(--space-2)", fontSize: "0.875rem", lineHeight: 1 }}
          >
            ↓
          </button>
          <button className={styles.removeButton} onClick={() => onRemove(index)}>
            Remove
          </button>
        </div>
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
            preSelectImageUrl={item.content}
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
  adminNotesMap,
  onRegisterSaveButton,
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
  adminNotesMap: Record<string, string[]>;
  onRegisterSaveButton: (node: React.ReactNode) => void;
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
  // Parallel array tracking pending image files for each explanation item (index-aligned)
  const [explanationFiles, setExplanationFiles] = useState<(File | null)[]>([]);
  const [isSavingWithUploads, setIsSavingWithUploads] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const { session } = useAuth();
  const [originalCode, setOriginalCode] = useState("");
  const fetcher = useFetcher<typeof action>();
  const saveFetcher = useFetcher<typeof action>();
  const deleteInstructionFetcher = useFetcher<typeof action>();
  const replaceInstructionFetcher = useFetcher<typeof action>();
  const [selectedContentIndex, setSelectedContentIndex] = useState<number | null>(null);
  const [instructionFilterEdit, setInstructionFilterEdit] = useState("");
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [replacementInstructionId, setReplacementInstructionId] = useState("");
  // Admin notes state
  const [adminNotes, setAdminNotes] = useState<string[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const adminNotesFetcher = useFetcher<typeof action>();

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
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${id}`;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [actionData, id, language]);

  // Watch saveFetcher (used for save-with-uploads flow)
  useEffect(() => {
    if (saveFetcher.data && saveFetcher.state === "idle") {
      if (saveFetcher.data.success) {
        onChangesDetected(false);
        const timer = setTimeout(() => {
          window.location.href = `/admin/instructions?lang=${language}&instructionId=${id}`;
        }, 1000);
        return () => clearTimeout(timer);
      } else if (saveFetcher.data.error) {
        alert(`Save failed: ${saveFetcher.data.error}`);
      }
    }
  }, [saveFetcher.data, saveFetcher.state, id, language]);

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
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${fetcher.data.newInstructionId}`;
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
        window.location.href = `/admin/instructions?lang=${language}`;
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
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${selectedInstructionId}`;
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
      setExplanationFiles(new Array(explanationWithKeys.length).fill(null));
    } else {
      // No data for this language, start with empty fields
      setId(instructionId);
      setTitle("");
      setDescription("");
      setType("default");
      setStatus("only title");
      setMissionId("");
      setExplanation([]);
      setExplanationFiles([]);
    }
    // Load admin notes for this instruction
    setAdminNotes(adminNotesMap[instructionId] || []);
    setShowNoteInput(false);
    setNewNoteText("");
  };

  const handleSelectInstruction = (instructionId: string) => {
    clearActionData();
    updateFormFields(instructionId);
  };

  const handleAddNote = async () => {
    const trimmed = newNoteText.trim();
    if (!trimmed || !selectedInstructionId) return;
    const updatedNotes = [...adminNotes, trimmed];
    setAdminNotes(updatedNotes);
    setNewNoteText("");
    setShowNoteInput(false);
    await saveAdminNotes(updatedNotes);
  };

  const handleRemoveNote = async (index: number) => {
    const updatedNotes = adminNotes.filter((_, i) => i !== index);
    setAdminNotes(updatedNotes);
    await saveAdminNotes(updatedNotes);
  };

  const handleStartEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setEditingNoteText(adminNotes[index]);
  };

  const handleSaveEditedNote = () => {
    if (editingNoteIndex === null) return;
    const trimmed = editingNoteText.trim();
    if (!trimmed) return;
    const updatedNotes = adminNotes.map((n, i) => (i === editingNoteIndex ? trimmed : n));
    setAdminNotes(updatedNotes);
    setEditingNoteIndex(null);
    setEditingNoteText("");
    saveAdminNotes(updatedNotes);
  };

  const handleCancelEditNote = () => {
    setEditingNoteIndex(null);
    setEditingNoteText("");
  };

  const saveAdminNotes = (notes: string[]) => {
    if (!selectedInstructionId || !session) return;
    const formData = new FormData();
    formData.append("actionType", "saveAdminNote");
    formData.append("instructionId", selectedInstructionId);
    formData.append("notes", JSON.stringify(notes));
    formData.append("accessToken", session.access_token || "");
    adminNotesFetcher.submit(formData, { method: "post" });
  };

  const addContent = (type: "text" | "image" | "video") => {
    const newItem: InstructionContentWithKey = {
      type,
      content: "",
      _key: `content-${Date.now()}-${Math.random()}`,
    };
    setExplanation([...explanation, newItem]);
    setExplanationFiles([...explanationFiles, null]);
  };

  const updateContent = (index: number, content: string) => {
    const updated = [...explanation];
    updated[index].content = content;
    setExplanation(updated);
  };

  const handleImageFileChange = (index: number, file: File | null, _preview: string) => {
    const updated = [...explanationFiles];
    // Grow array if needed
    while (updated.length <= index) updated.push(null);
    updated[index] = file;
    setExplanationFiles(updated);
  };

  const removeContent = (index: number) => {
    setExplanation(explanation.filter((_, i) => i !== index));
    setExplanationFiles(explanationFiles.filter((_, i) => i !== index));
    if (selectedContentIndex === index) {
      setSelectedContentIndex(null);
    } else if (selectedContentIndex !== null && selectedContentIndex > index) {
      setSelectedContentIndex(selectedContentIndex - 1);
    }
  };

  const moveContentUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...explanation];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setExplanation(updated);
    const updatedFiles = [...explanationFiles];
    [updatedFiles[idx - 1], updatedFiles[idx]] = [updatedFiles[idx], updatedFiles[idx - 1]];
    setExplanationFiles(updatedFiles);
    if (selectedContentIndex === idx) setSelectedContentIndex(idx - 1);
    else if (selectedContentIndex === idx - 1) setSelectedContentIndex(idx);
  };

  const moveContentDown = (idx: number) => {
    if (idx >= explanation.length - 1) return;
    const updated = [...explanation];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setExplanation(updated);
    const updatedFiles = [...explanationFiles];
    [updatedFiles[idx], updatedFiles[idx + 1]] = [updatedFiles[idx + 1], updatedFiles[idx]];
    setExplanationFiles(updatedFiles);
    if (selectedContentIndex === idx) setSelectedContentIndex(idx + 1);
    else if (selectedContentIndex === idx + 1) setSelectedContentIndex(idx);
  };

  /** Auto-upload pending images then submit via fetcher */
  const handleSaveWithUploads = async () => {
    if (!session) return;
    setIsSavingWithUploads(true);

    try {
      // Find image items with empty URL but a pending file
      const pendingItems = explanation
        .map((item, idx) => ({ item, idx, file: explanationFiles[idx] ?? null }))
        .filter(({ item, file }) => item.type === "image" && !item.content && file !== null);

      if (pendingItems.length > 0) {
        const updatedExplanation = [...explanation];
        const updatedFiles = [...explanationFiles];

        for (const { idx, file } of pendingItems) {
          const result = await uploadImage(file!, "instructions");
          if ("error" in result) {
            alert(`Upload failed for image ${idx + 1}: ${result.error}`);
            setIsSavingWithUploads(false);
            return;
          }
          updatedExplanation[idx] = { ...updatedExplanation[idx], content: result.url };
          updatedFiles[idx] = null;
        }

        setExplanation(updatedExplanation);
        setExplanationFiles(updatedFiles);

        // Generate code from the updated explanation
        const cleanExplanation: InstructionContent[] = updatedExplanation.map(({ _key, ...item }) => item);
        const instructionData: Instruction = {
          id,
          title,
          ...(description && { description }),
          status,
          explanation: cleanExplanation,
          ...(type === "link" && { type, missionId }),
        };
        const data = JSON.stringify(instructionData, null, 2);

        const formData = new FormData();
        formData.append("actionType", "saveInstruction");
        formData.append("id", id);
        formData.append("dataEn", data);
        formData.append("language", language);
        formData.append("accessToken", session.access_token || "");
        saveFetcher.submit(formData, { method: "post" });
      } else {
        // No pending uploads — submit normally
        const formData = new FormData();
        formData.append("actionType", "saveInstruction");
        formData.append("id", id);
        formData.append("dataEn", generateCode());
        formData.append("language", language);
        formData.append("accessToken", session.access_token || "");
        saveFetcher.submit(formData, { method: "post" });
      }
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingWithUploads(false);
    }
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

      window.location.href = `/admin/instructions?lang=${targetLang}`;
    } catch (error) {
      console.error("Translation error:", error);
      alert(`Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Track if there are unsaved changes
  const hasUnsavedChanges = selectedInstructionId && originalCode !== "" && generateCode() !== originalCode;

  // Register the Save to Database button in the sticky nav
  useEffect(() => {
    if (!selectedInstructionId) {
      onRegisterSaveButton(null);
      return;
    }
    const isSaving = isSavingWithUploads || saveFetcher.state !== "idle";
    onRegisterSaveButton(
      <button
        type="button"
        className={styles.submitButton}
        disabled={!selectedInstructionId || !session || isSaving}
        onClick={handleSaveWithUploads}
        data-admin-primary-save="true"
        style={{ fontSize: "0.875rem", padding: "var(--space-2) var(--space-4)" }}
      >
        {isSaving
          ? "Saving..."
          : `Save to Database (${language === "he" ? "Hebrew" : "English"})`}
      </button>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstructionId, isSavingWithUploads, saveFetcher.state, session, language]);

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
                            window.location.href = `/admin/missions?lang=${language}&missionId=${mission.id}`;
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
          {type === "default" && (
            <div className={styles.formSection}>
              <h2
                className={styles.sectionTitle}
                style={{ color: hasUnsavedChanges ? "red" : "var(--color-neutral-12)" }}
              >
                Explanation Content
              </h2>

              {explanation.map((item, index) => (
                <ExplanationContentItem
                  key={item._key || `fallback-${index}`}
                  item={item}
                  index={index}
                  onUpdate={updateContent}
                  onRemove={removeContent}
                  isSelected={selectedContentIndex === index}
                  onSelect={setSelectedContentIndex}
                  onMoveUp={moveContentUp}
                  onMoveDown={moveContentDown}
                  canMoveUp={index > 0}
                  canMoveDown={index < explanation.length - 1}
                  instructions={instructions}
                  instructionsEn={instructionsEn}
                  instructionsHe={instructionsHe}
                  onNavigationRequest={onNavigationRequest}
                  imageFile={explanationFiles[index] ?? null}
                  onImageFileChange={handleImageFileChange}
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

          <div className={styles.formSection}>
            <h2
              className={styles.sectionTitle}
              style={{ color: hasUnsavedChanges ? "red" : "var(--color-neutral-12)" }}
            >
              Instruction Details
            </h2>
            <div className={styles.formGrid}>
              <div className={styles.div12}>
                <div className={classNames(styles.formGroup, styles.div11)}>
                  <label className={styles.label}>
                    Title. (Can be used as admin comment to identify the instruction. we can set the title for end user
                    in the mission by rename)
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Getting Started with Advanced Features"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Description (to be shown to the end user under the renamed title before he click the instruction)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Brief description of the instruction"
                />
              </div>

              <div className={styles.div5}>
                <div>
                  <div className={classNames(styles.formGroup, styles.div9)}>
                    <label className={styles.label}>Instruction ID</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      placeholder="e.g., 9"
                    />
                  </div>
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
                <div className={styles.formGroup}>
                  <label className={styles.label}>Instruction Type</label>
                  <select
                    className={styles.input}
                    value={type}
                    onChange={(e) => setType(e.target.value as "default" | "link")}
                  >
                    <option value="default">Standard</option>
                    <option value="link">Link</option>
                  </select>
                </div>
              </div>

              {type === "link" && (
                <div className={styles.formGroup}>
                  <div className={styles.div6}>
                    <label className={styles.label}>Target Mission</label>
                    <small
                      style={{ color: "var(--color-neutral-11)", fontSize: "0.875rem", marginTop: "var(--space-1)" }}
                      className={styles.small1}
                    >
                      The mission to navigate to when this instruction is clicked
                    </small>
                  </div>
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
                </div>
              )}
            </div>
          </div>
          <div className={styles.previewSection}>
            <div
              className={styles.formSection}
              style={{ background: "var(--color-neutral-3)", border: "2px dashed var(--color-neutral-7)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: adminNotes.length > 0 || showNoteInput ? "var(--space-4)" : 0,
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-subheading)",
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "var(--color-neutral-11)",
                    margin: 0,
                  }}
                >
                  🔒 Admin Notes {adminNotes.length > 0 && `(${adminNotes.length})`}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNoteInput((v) => !v)}
                  className={styles.addButton}
                  disabled={!session}
                  style={{ fontSize: "0.8125rem" }}
                >
                  {showNoteInput ? "Cancel" : "+ Admin Note"}
                </button>
              </div>

              {showNoteInput && (
                <div style={{ marginBottom: "var(--space-3)" }}>
                  <textarea
                    className={styles.textarea}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Write an admin note..."
                    style={{ minHeight: "72px", marginBottom: "var(--space-2)" }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                  />
                  <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNoteInput(false);
                        setNewNoteText("");
                      }}
                      className={styles.addButton}
                      style={{ fontSize: "0.8125rem" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className={styles.submitButton}
                      disabled={!newNoteText.trim() || adminNotesFetcher.state !== "idle"}
                      style={{ fontSize: "0.8125rem", padding: "var(--space-2) var(--space-4)" }}
                    >
                      {adminNotesFetcher.state !== "idle" ? "Saving..." : "Add Note"}
                    </button>
                  </div>
                </div>
              )}

              {adminNotes.length > 0 && (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  {adminNotes.map((note, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "var(--space-2)",
                        padding: "var(--space-2) var(--space-3)",
                        background: editingNoteIndex === idx ? "var(--color-accent-2)" : "var(--color-neutral-2)",
                        border: editingNoteIndex === idx ? "1px solid var(--color-accent-7)" : "1px solid var(--color-neutral-6)",
                        borderRadius: "var(--radius-2)",
                      }}
                    >
                      <span
                        style={{
                          marginTop: "2px",
                          fontSize: "0.875rem",
                          color: "var(--color-neutral-10)",
                          flexShrink: 0,
                        }}
                      >
                        ☐
                      </span>
                      {editingNoteIndex === idx ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                          <textarea
                            className={styles.textarea}
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            style={{ minHeight: "60px", fontSize: "0.875rem", marginBottom: 0 }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleSaveEditedNote();
                              } else if (e.key === "Escape") {
                                handleCancelEditNote();
                              }
                            }}
                          />
                          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={handleCancelEditNote}
                              className={styles.addButton}
                              style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditedNote}
                              className={styles.submitButton}
                              disabled={!editingNoteText.trim()}
                              style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span
                          style={{
                            flex: 1,
                            fontFamily: "var(--font-body)",
                            fontSize: "0.875rem",
                            color: "var(--color-neutral-12)",
                            wordBreak: "break-word",
                          }}
                        >
                          {note}
                        </span>
                      )}
                      {editingNoteIndex !== idx && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditNote(idx)}
                            className={styles.addButton}
                            style={{
                              flexShrink: 0,
                              fontSize: "0.75rem",
                              padding: "var(--space-1) var(--space-2)",
                            }}
                            title="Edit note"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveNote(idx)}
                            className={styles.removeButton}
                            style={{
                              marginRight: 0,
                              flexShrink: 0,
                              fontSize: "0.75rem",
                              padding: "var(--space-1) var(--space-2)",
                            }}
                            title="Remove note"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {adminNotes.length === 0 && !showNoteInput && (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-neutral-9)", margin: 0, fontStyle: "italic" }}>
                  No admin notes yet. Click &quot;+ Admin Note&quot; to add one.
                </p>
              )}
            </div>
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

            {((actionData?.success && actionData.message) || (saveFetcher.data?.success && saveFetcher.data.message)) && (
              <div className={styles.successMessage} style={{ marginTop: "var(--space-3)" }}>
                {saveFetcher.data?.message || actionData?.message}
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
