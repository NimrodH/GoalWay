import { useState, useEffect, useRef, useMemo } from "react";
import { useActionData, useLoaderData, useSearchParams, useFetcher } from "react-router";
import classNames from "classnames";
import { AdminLayout } from "~/components/admin-layout/admin-layout";
import { useAuth } from "~/hooks/use-auth";
import { uploadImage, listAllImages } from "~/lib/image-upload";
import {
  fetchImageKeywords,
  saveImageKeywords,
  fetchCategoriesForPaths,
  type ImageCategories,
} from "~/lib/image-keywords";
import type { Instruction, InstructionContent, Annotation } from "~/services/instructions.server";
import type { Mission } from "~/services/missions.server";
import { ImageAnnotationEditor } from "~/components/image-annotation-editor/image-annotation-editor";
import { ImageAnnotationView } from "~/components/image-annotation-view/image-annotation-view";
import styles from "./admin.module.css";
import { loader as adminLoader, action as adminAction } from "~/routes/admin";

type InstructionContentWithKey = InstructionContent & { _key?: string; annotations?: Annotation[] };

export const loader = adminLoader;
export const action = adminAction;

export default function AdminInstructionsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AdminLayout loaderData={loaderData} activeSection="instructions">
      {({ onChangesDetected, onNavigationRequest, clearActionData }) => (
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
          categoryValuesRaw={loaderData.categoryValuesRaw}
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
  returnInstructionId,
  returnContentIndex,
  returnLang,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  instructions: Instruction[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  preSelectImageUrl?: string;
  returnInstructionId?: string;
  returnContentIndex?: number;
  returnLang?: string;
}) {
  const [images, setImages] = useState<Array<{ name: string; url: string; path: string }>>([]);
  const [imageCategoriesMap, setImageCategoriesMap] = useState<Record<string, ImageCategories>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtering state
  const [imageNameFilter, setImageNameFilter] = useState("");
  const [softwareFilter, setSoftwareFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [screenFilter, setScreenFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");

  // Extracted unique categories for dropdowns, dynamically computed based on hierarchy
  const availableSoftware = useMemo(() => {
    const set = new Set<string>();
    Object.values(imageCategoriesMap).forEach((cat) => {
      if (cat.software) set.add(cat.software);
    });
    return Array.from(set).sort();
  }, [imageCategoriesMap]);

  const availableModule = useMemo(() => {
    const set = new Set<string>();
    Object.values(imageCategoriesMap).forEach((cat) => {
      if (softwareFilter && cat.software !== softwareFilter) return;
      if (cat.module) set.add(cat.module);
    });
    return Array.from(set).sort();
  }, [imageCategoriesMap, softwareFilter]);

  const availableScreen = useMemo(() => {
    const set = new Set<string>();
    Object.values(imageCategoriesMap).forEach((cat) => {
      if (softwareFilter && cat.software !== softwareFilter) return;
      if (moduleFilter && cat.module !== moduleFilter) return;
      if (cat.screen) set.add(cat.screen);
    });
    return Array.from(set).sort();
  }, [imageCategoriesMap, softwareFilter, moduleFilter]);

  const availableItem = useMemo(() => {
    const set = new Set<string>();
    Object.values(imageCategoriesMap).forEach((cat) => {
      if (softwareFilter && cat.software !== softwareFilter) return;
      if (moduleFilter && cat.module !== moduleFilter) return;
      if (screenFilter && cat.screen !== screenFilter) return;
      if (cat.item) set.add(cat.item);
    });
    return Array.from(set).sort();
  }, [imageCategoriesMap, softwareFilter, moduleFilter, screenFilter]);

  useEffect(() => {
    if (isOpen) {
      loadImages();
      setImageNameFilter("");
      setSoftwareFilter("");
      setModuleFilter("");
      setScreenFilter("");
      setItemFilter("");
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
      const paths = result.images.map((img) => img.path);
      const catMap = await fetchCategoriesForPaths(paths);
      setImageCategoriesMap(catMap);

      if (preSelectImageUrl) {
        const found = result.images.find((img) => img.url === preSelectImageUrl);
        if (found) {
          setSelectedImages(new Set([found.path]));
        } else {
          setSelectedImages(new Set());
        }
      } else {
        setSelectedImages(new Set());
      }
    }
  };

  const isImageUsed = (imageUrl: string) => {
    const allInstructions = [...instructionsEn, ...instructionsHe];
    const found = allInstructions.some((instruction) => {
      if (!instruction.explanation || !Array.isArray(instruction.explanation)) return false;
      return instruction.explanation.some((item) => item.type === "image" && item.content === imageUrl);
    });
    if (!found) {
      console.log("Image not found in any instruction:", imageUrl);
      console.log("Total instructions checked:", allInstructions.length);
    }
    return found;
  };

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

  const handleDeleteSelected = async () => {
    if (selectedImages.size === 0) {
      alert("Please select at least one image to delete");
      return;
    }
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedImages.size} image(s)?\n\nThis action cannot be undone.`,
    );
    if (!confirmDelete) return;

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

    setSelectedImages(new Set());
    await loadImages();
  };

  if (!isOpen) return null;

  const filteredImages = images.filter((image) => {
    const cat = imageCategoriesMap[image.path];
    if (softwareFilter && cat?.software !== softwareFilter) return false;
    if (moduleFilter && cat?.module !== moduleFilter) return false;
    if (screenFilter && cat?.screen !== screenFilter) return false;
    if (itemFilter && cat?.item !== itemFilter) return false;
    if (!imageNameFilter.trim()) return true;
    const term = imageNameFilter.toLowerCase().trim();
    if (image.name.toLowerCase().includes(term)) return true;
    const kws = cat?.keywords ?? [];
    return kws.some((kw) => kw.toLowerCase().includes(term));
  });

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
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid var(--color-neutral-6)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
                <input
                  type="text"
                  className={styles.input}
                  value={imageNameFilter}
                  onChange={(e) => setImageNameFilter(e.target.value)}
                  placeholder="Filter by name or keyword..."
                  style={{ flex: 1, minWidth: "200px", fontSize: "0.875rem" }}
                />

                <select
                  className={styles.input}
                  value={softwareFilter}
                  onChange={(e) => {
                    setSoftwareFilter(e.target.value);
                    setModuleFilter("");
                    setScreenFilter("");
                    setItemFilter("");
                  }}
                  style={{ width: "140px", fontSize: "0.875rem" }}
                >
                  <option value="">All Software</option>
                  {availableSoftware.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.input}
                  value={moduleFilter}
                  onChange={(e) => {
                    setModuleFilter(e.target.value);
                    setScreenFilter("");
                    setItemFilter("");
                  }}
                  style={{ width: "140px", fontSize: "0.875rem" }}
                >
                  <option value="">All Modules</option>
                  {availableModule.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.input}
                  value={screenFilter}
                  onChange={(e) => {
                    setScreenFilter(e.target.value);
                    setItemFilter("");
                  }}
                  style={{ width: "140px", fontSize: "0.875rem" }}
                >
                  <option value="">All Screens</option>
                  {availableScreen.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.input}
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  style={{ width: "140px", fontSize: "0.875rem" }}
                >
                  <option value="">All Items</option>
                  {availableItem.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>

                {(imageNameFilter || softwareFilter || moduleFilter || screenFilter || itemFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageNameFilter("");
                      setSoftwareFilter("");
                      setModuleFilter("");
                      setScreenFilter("");
                      setItemFilter("");
                    }}
                    className={styles.addButton}
                    style={{ minWidth: "60px", fontSize: "0.875rem" }}
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                        const returnParams =
                          returnInstructionId !== undefined && returnContentIndex !== undefined
                            ? `&returnInstructionId=${encodeURIComponent(returnInstructionId)}&returnContentIndex=${returnContentIndex}&returnLang=${returnLang ?? "en"}`
                            : "";
                        sessionStorage.setItem("libraryFilteredImages", JSON.stringify(filteredImages));
                        window.location.href = `/instructions-with-images?imageUrl=${encodeURIComponent(selectedImage.url)}${returnParams}`;
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
            </div>

            <div className={styles.imageGrid}>
              {filteredImages.map((image) => {
                  const isUsed = isImageUsed(image.url);
                  const isSelected = selectedImages.has(image.path);
                  const cat = imageCategoriesMap[image.path];
                  const keywords = cat?.keywords ?? [];

                  return (
                    <div
                      key={image.path}
                      className={styles.imageGridItem}
                      onClick={() => {
                        const returnParams =
                          returnInstructionId !== undefined && returnContentIndex !== undefined
                            ? `&returnInstructionId=${encodeURIComponent(returnInstructionId)}&returnContentIndex=${returnContentIndex}&returnLang=${returnLang ?? "en"}`
                            : "";
                        sessionStorage.setItem("libraryFilteredImages", JSON.stringify(filteredImages));
                        window.location.href = `/instructions-with-images?imageUrl=${encodeURIComponent(image.url)}${returnParams}`;
                      }}
                      style={{
                        position: "relative",
                        border: isSelected ? "3px solid var(--color-accent-9)" : undefined,
                        opacity: isUsed ? 1 : 0.6,
                      }}
                    >
                      <div
                        style={{ position: "absolute", top: "var(--space-2)", left: "var(--space-2)", zIndex: 10 }}
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
                      {keywords.length > 0 && (
                        <div
                          style={{
                            padding: "var(--space-1) var(--space-2)",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-1)",
                          }}
                        >
                          {keywords.map((kw) => (
                            <span
                              key={kw}
                              style={{
                                background: "var(--color-accent-3)",
                                color: "var(--color-accent-11)",
                                borderRadius: "var(--radius-round)",
                                padding: "1px 6px",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
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
  instructionId,
  language,
  onNavigationRequest,
  imageFile,
  onImageFileChange,
  onUpdateAnnotations,
  hasUnsavedChanges,
  onSilentSave,
  categoryValuesRaw,
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
  instructionId: string;
  language: string;
  onNavigationRequest: (navigationFn: () => void) => void;
  imageFile: File | null;
  onImageFileChange: (index: number, file: File | null, preview: string) => void;
  onUpdateAnnotations: (index: number, annotations: Annotation[]) => void;
  hasUnsavedChanges: boolean;
  onSilentSave: () => Promise<void>;
  categoryValuesRaw: Array<{
    software: string | null;
    module: string | null;
    screen: string | null;
    item: string | null;
    keywords: string[];
  }>;
}) {
  const [imagePreview, setImagePreview] = useState<string>(item.type === "image" ? item.content : "");
  const [isUploading, setIsUploading] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Hide upload source panel if the image is already set (loaded from DB)
  const [showUploadSource, setShowUploadSource] = useState(
    !(item.type === "image" && item.content && item.content.startsWith("http")),
  );
  // Keywords state
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [software, setSoftware] = useState("");
  const [moduleVal, setModuleVal] = useState("");
  const [screenVal, setScreenVal] = useState("");
  const [itemVal, setItemVal] = useState("");

  const [isSavingKeywords, setIsSavingKeywords] = useState(false);
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const { session } = useAuth();
  const keywordsFetcher = useFetcher();

  const availableSoftware = useMemo(
    () => Array.from(new Set(categoryValuesRaw.map((c) => c.software).filter(Boolean))) as string[],
    [categoryValuesRaw],
  );
  const availableModule = useMemo(
    () =>
      Array.from(
        new Set(
          categoryValuesRaw
            .filter((c) => !software || c.software === software)
            .map((c) => c.module)
            .filter(Boolean),
        ),
      ) as string[],
    [categoryValuesRaw, software],
  );
  const availableScreen = useMemo(
    () =>
      Array.from(
        new Set(
          categoryValuesRaw
            .filter((c) => (!software || c.software === software) && (!moduleVal || c.module === moduleVal))
            .map((c) => c.screen)
            .filter(Boolean),
        ),
      ) as string[],
    [categoryValuesRaw, software, moduleVal],
  );
  const availableItem = useMemo(
    () =>
      Array.from(
        new Set(
          categoryValuesRaw
            .filter(
              (c) =>
                (!software || c.software === software) &&
                (!moduleVal || c.module === moduleVal) &&
                (!screenVal || c.screen === screenVal),
            )
            .map((c) => c.item)
            .filter(Boolean),
        ),
      ) as string[],
    [categoryValuesRaw, software, moduleVal, screenVal],
  );

  const availableKeywords = useMemo(() => {
    const kws = categoryValuesRaw.flatMap((c) => c.keywords || []);
    return Array.from(new Set(kws)).filter(Boolean).sort() as string[];
  }, [categoryValuesRaw]);

  // Derive the image name / upload filename from first keyword
  const imageName = keywords[0]?.trim() ?? "";

  // When the item already has an uploaded image, load its existing keywords
  useEffect(() => {
    if (item.type === "image" && item.content && item.content.startsWith("http")) {
      // Derive the storage path from the URL — path is everything after "/object/public/mission-images/"
      const marker = "/object/public/mission-images/";
      const markerIdx = item.content.indexOf(marker);
      if (markerIdx !== -1) {
        const storagePath = decodeURIComponent(item.content.slice(markerIdx + marker.length).split("?")[0]);
        fetchCategoriesForPaths([storagePath]).then((catMap) => {
          const cats = catMap[storagePath];
          if (cats) {
            setKeywords(cats.keywords ?? []);
            setSoftware(cats.software ?? "");
            setModuleVal(cats.module ?? "");
            setScreenVal(cats.screen ?? "");
            setItemVal(cats.item ?? "");
          }
        });
      }
    }
  }, [item.content]);

  useEffect(() => {
    if (keywordsFetcher.data && keywordsFetcher.state === "idle") {
      const data = keywordsFetcher.data as any;
      if (data.success) {
        // Success
      } else if (data.error) {
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
    keywordInputRef.current?.focus();
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleSaveKeywords = async () => {
    if (!item.content || !item.content.startsWith("http")) return;
    if (!session) {
      alert("Please sign in to save keywords");
      return;
    }
    const marker = "/object/public/mission-images/";
    const markerIdx = item.content.indexOf(marker);
    if (markerIdx === -1) return;
    const storagePath = decodeURIComponent(item.content.slice(markerIdx + marker.length).split("?")[0]);
    setIsSavingKeywords(true);

    const formData = new FormData();
    formData.append("actionType", "updateKeywords");
    formData.append("imagePath", storagePath);
    formData.append("keywords", JSON.stringify(keywords));
    formData.append("software", software);
    formData.append("module", moduleVal);
    formData.append("screen", screenVal);
    formData.append("item", itemVal);
    formData.append("accessToken", session.access_token || "");

    keywordsFetcher.submit(formData, { method: "post" });
    setIsSavingKeywords(false);
  };

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

  const handleAutoUploadFile = async (file: File) => {
    const autoName = file.name.replace(/\.[^.]+$/, "");
    const updatedKeywords = [autoName, ...keywords.filter((k) => k !== autoName)];
    setKeywords(updatedKeywords);
    setIsUploading(true);
    try {
      const result = await uploadImage(file, "instructions", autoName);
      if ("error" in result) {
        console.error("Auto-upload failed:", result.error);
      } else {
        setImagePreview(result.url);
        onUpdate(index, result.url);
        onImageFileChange(index, null, result.url);
        setShowUploadSource(false);
        setShowAdvanced(true);
        setTimeout(() => keywordInputRef.current?.focus(), 0);
        const kwsToSave = updatedKeywords.length > 0 ? updatedKeywords : [autoName];
        await saveImageKeywords(result.path, kwsToSave);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          if (navigator.permissions) {
            const permissionStatus = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
            if (permissionStatus.state === "denied") {
              throw new Error("Clipboard access denied.");
            }
          }
          const clipboardItems = await navigator.clipboard.read();
          for (const clipItem of clipboardItems) {
            const imageType = clipItem.types.find((type) => type.startsWith("image/"));
            if (imageType) {
              const blob = await clipItem.getType(imageType);
              const timestamp = Date.now();
              const extension = imageType.split("/")[1] || "png";
              const file = new File([blob], `pasted-image-${timestamp}.${extension}`, { type: blob.type });
              const reader = new FileReader();
              reader.onloadend = () => {
                const preview = reader.result as string;
                setImagePreview(preview);
                onImageFileChange(index, file, preview);
                void handleAutoUploadFile(file);
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
          const allTypes = clipboardItems.flatMap((ci) => ci.types).join(", ");
          alert(`No image found in clipboard.\n\nAvailable formats: ${allTypes || "none"}`);
          return;
        } catch (clipboardError) {
          console.warn("Clipboard API failed, trying fallback:", clipboardError);
        }
      }
      alert(
        'Clipboard API not available or access denied.\n\nTry this instead:\n1. Click in the "Paste Zone" box below\n2. Press Ctrl+V (or Cmd+V on Mac)\n\nOR\n\nUse the file upload button to select an image manually.',
      );
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
        pasteZone.addEventListener("paste", async (e: ClipboardEvent) => {
          e.preventDefault();
          const items = e.clipboardData?.items;
          if (!items) return;
          for (let i = 0; i < items.length; i++) {
            const pastedItem = items[i];
            if (pastedItem.type.startsWith("image/")) {
              const blob = pastedItem.getAsFile();
              if (blob) {
                const timestamp = Date.now();
                const extension = blob.type.split("/")[1] || "png";
                const file = new File([blob], `pasted-image-${timestamp}.${extension}`, { type: blob.type });
                const reader = new FileReader();
                reader.onloadend = () => {
                  const preview = reader.result as string;
                  setImagePreview(preview);
                  onImageFileChange(index, file, preview);
                  void handleAutoUploadFile(file);
                };
                reader.readAsDataURL(blob);
                pasteZone.remove();
                return;
              }
            }
          }
          alert("No image found in the pasted content.");
        });
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
      alert(`Paste failed: ${errorMessage}\n\nAlternative: Use the file upload button.`);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    // Ask for image name via dialog — this becomes the first keyword
    const promptedName = window.prompt(
      "Enter a name for this image (will be used as filename and first keyword):",
      imageName || "",
    );
    if (promptedName === null) return; // user cancelled
    const trimmedName = promptedName.trim();
    if (!trimmedName) {
      alert("Image name cannot be empty.");
      return;
    }
    // Set as first keyword (replace or prepend)
    const updatedKeywords = [
      trimmedName,
      ...keywords.filter((k) => k !== trimmedName).slice(keywords[0] === imageName ? 1 : 0),
    ];
    setKeywords(updatedKeywords);

    setIsUploading(true);
    const result = await uploadImage(imageFile, "instructions", trimmedName);
    setIsUploading(false);

    if ("error" in result) {
      alert(`Upload failed: ${result.error}`);
    } else {
      setImagePreview(result.url);
      onUpdate(index, result.url);
      onImageFileChange(index, null, result.url);
      setShowUploadSource(false);
      // Save keywords to Supabase after successful upload
      const kwsToSave = updatedKeywords.length > 0 ? updatedKeywords : [trimmedName];
      await saveImageKeywords(result.path, kwsToSave);
    }
  };

  const handleSelectFromLibrary = (url: string) => {
    setImagePreview(url);
    onUpdate(index, url);
    onImageFileChange(index, null, url);
    setShowUploadSource(false);
  };

  return (
    <div
      className={styles.contentItem}
      data-content-index={index}
      style={{ border: isSelected ? "2px solid var(--color-accent-9)" : undefined }}
    >
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
            data-explanation-id="admin-instruction-move-up"
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
            data-explanation-id="admin-instruction-move-down"
          >
            ↓
          </button>
          <button
            className={styles.removeButton}
            onClick={() => onRemove(index)}
            data-explanation-id="admin-instruction-remove-block"
          >
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
          {/* ── Advanced toggle ──────────────────────────────────────── */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-2)", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className={styles.addButton}
              style={{ fontSize: "0.8125rem" }}
            >
              {showAdvanced ? "▲ Hide Image Details" : "▼ Image Details"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!showUploadSource && hasUnsavedChanges) {
                  const proceed = window.confirm(
                    "You have unsaved changes to this instruction.\n\nChanging the image will reset the upload panel and your changes may be lost.\n\nDo you want to continue without saving?",
                  );
                  if (!proceed) return;
                }
                setShowUploadSource((v) => !v);
              }}
              className={styles.addButton}
              style={{ fontSize: "0.8125rem" }}
              data-explanation-id="admin-instruction-change-image"
            >
              {showUploadSource ? "▲ Hide Change Image" : "🔄 Change Image"}
            </button>
          </div>

          {showAdvanced && (
            <>
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

              {/* ── Keywords / Tags UI ─────────────────────────────────── */}
              <div
                className={styles.formGroup}
                style={{
                  marginTop: "var(--space-3)",
                  padding: "var(--space-3)",
                  background: "var(--color-neutral-2)",
                  border: "1px solid var(--color-neutral-6)",
                  borderRadius: "var(--radius-2)",
                }}
              >
                <label
                  className={styles.label}
                  style={{ marginBottom: "var(--space-3)", display: "block", fontSize: "1.1rem" }}
                >
                  🏷️ Image Categories & Keywords
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--space-4)",
                    marginBottom: "var(--space-4)",
                  }}
                >
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Software</label>
                    <input
                      type="text"
                      list="software-list-inline"
                      value={software}
                      onChange={(e) => {
                        setSoftware(e.target.value);
                        setModuleVal("");
                        setScreenVal("");
                        setItemVal("");
                      }}
                      placeholder="e.g. Photoshop, Excel..."
                      className={styles.input}
                    />
                    <datalist id="software-list-inline">
                      {availableSoftware.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Module</label>
                    <input
                      type="text"
                      list="module-list-inline"
                      value={moduleVal}
                      onChange={(e) => {
                        setModuleVal(e.target.value);
                        setScreenVal("");
                        setItemVal("");
                      }}
                      placeholder="e.g. CRM, Inventory..."
                      className={styles.input}
                    />
                    <datalist id="module-list-inline">
                      {availableModule.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Screen</label>
                    <input
                      type="text"
                      list="screen-list-inline"
                      value={screenVal}
                      onChange={(e) => {
                        setScreenVal(e.target.value);
                        setItemVal("");
                      }}
                      placeholder="e.g. Dashboard, Settings..."
                      className={styles.input}
                    />
                    <datalist id="screen-list-inline">
                      {availableScreen.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Item</label>
                    <input
                      type="text"
                      list="item-list-inline"
                      value={itemVal}
                      onChange={(e) => setItemVal(e.target.value)}
                      placeholder="e.g. Save Button, Profile Pic..."
                      className={styles.input}
                    />
                    <datalist id="item-list-inline">
                      {availableItem.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <label className={styles.label} style={{ marginBottom: "var(--space-2)", display: "block" }}>
                  General Keywords
                </label>

                {/* Tag chips */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--space-2)",
                    marginBottom: keywords.length > 0 ? "var(--space-2)" : 0,
                  }}
                >
                  {keywords.map((kw, i) => (
                    <span
                      key={kw}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-1)",
                        background: i === 0 ? "var(--color-accent-4)" : "var(--color-neutral-4)",
                        color: i === 0 ? "var(--color-accent-12)" : "var(--color-neutral-12)",
                        border: `1px solid ${i === 0 ? "var(--color-accent-7)" : "var(--color-neutral-7)"}`,
                        borderRadius: "var(--radius-round)",
                        padding: "2px 10px 2px 10px",
                        fontSize: "0.8125rem",
                        fontWeight: i === 0 ? 700 : 500,
                      }}
                    >
                      {i === 0 && <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>name·</span>}
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0 0 0 2px",
                          lineHeight: 1,
                          color: "inherit",
                          opacity: 0.7,
                          fontSize: "0.875rem",
                        }}
                        title={`Remove keyword "${kw}"`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add keyword input */}
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <input
                    ref={keywordInputRef}
                    type="text"
                    list={`keyword-list-${index}`}
                    className={styles.input}
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Add a keyword..."
                    style={{ flex: 1, fontSize: "0.875rem" }}
                  />
                  <datalist id={`keyword-list-${index}`}>
                    {availableKeywords.map((val) => (
                      <option key={val} value={val} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addKeyword();
                    }}
                    onClick={addKeyword}
                    className={styles.addButton}
                    disabled={!keywordInput.trim()}
                    style={{ fontSize: "0.875rem" }}
                  >
                    + Add
                  </button>
                </div>

                {/* Save keywords button (shown when image is already uploaded) */}
                {item.content && item.content.startsWith("http") && (
                  <div style={{ marginTop: "var(--space-2)", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={handleSaveKeywords}
                      className={styles.addButton}
                      disabled={isSavingKeywords || keywordsFetcher.state !== "idle"}
                      style={{ fontSize: "0.8125rem" }}
                      data-explanation-id="admin-instruction-save-metadata"
                    >
                      {isSavingKeywords || keywordsFetcher.state !== "idle" ? "Saving..." : "💾 Save Keywords"}
                    </button>
                  </div>
                )}
              </div>
              {/* ── End Keywords UI ─────────────────────────────────────── */}
            </>
          )}

          {/* ── Image preview — always visible ─────────────────────── */}
          {imagePreview && (
            <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
              <div style={{ maxWidth: "400px" }}>
                {item.content &&
                  !imageFile &&
                  (() => {
                    const storedName = item.content.split("/").pop()?.split("?")[0] ?? "";
                    return (
                      <div
                        style={{
                          marginBottom: "var(--space-2)",
                          fontSize: "0.8125rem",
                          color: "var(--color-neutral-11)",
                          fontFamily: "var(--font-code)",
                          wordBreak: "break-all",
                        }}
                      >
                        📁 <strong>Stored as:</strong> {storedName}
                      </div>
                    );
                  })()}
                <ImageAnnotationView src={imagePreview} alt="Preview" annotations={item.annotations ?? []} />
              </div>
            </div>
          )}

          {/* ── Upload source buttons ─────────────────────────────────── */}
          {showUploadSource && (
            <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
              <label className={styles.label}>Upload New Image or Select from Library</label>
              <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (hasUnsavedChanges) {
                      await onSilentSave();
                    }
                    setShowImageLibrary(true);
                  }}
                  className={styles.addButton}
                  data-explanation-id="admin-instruction-library"
                >
                  📚 Select from Library
                </button>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className={styles.addButton}
                  data-paste-button
                  data-explanation-id="admin-instruction-paste-clipboard"
                >
                  📋 Paste from Clipboard
                </button>
                <input type="file" accept="image/*" onChange={handleImageChange} className={styles.input} />
              </div>
              {imageFile && !isUploading && (
                <div style={{ marginTop: "var(--space-2)" }}>
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <div style={{ flex: 1, fontSize: "0.8125rem", color: "var(--color-neutral-11)" }}>
                      Image ready to upload
                    </div>
                    <button type="button" onClick={handleImageUpload} className={styles.addButton}>
                      Upload to Supabase
                    </button>
                  </div>
                </div>
              )}
              {isUploading && (
                <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>Uploading...</p>
              )}
            </div>
          )}
          {item.content && (
            <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowAnnotationEditor(true)}
                className={styles.addButton}
                style={{ fontWeight: 600 }}
                title="Add numbered rectangles to this image"
                data-explanation-id="admin-instruction-annotate"
              >
                📐 Annotate ({item.annotations?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    const proceed = window.confirm(
                      "You have unsaved changes to this instruction.\n\nNavigating away will lose your changes.\n\nDo you want to continue without saving?",
                    );
                    if (!proceed) return;
                  }
                  onNavigationRequest(() => {
                    window.location.href = `/instructions-with-images?imageUrl=${encodeURIComponent(item.content)}&returnInstructionId=${encodeURIComponent(instructionId)}&returnContentIndex=${index}&returnLang=${language}`;
                  });
                }}
                className={styles.addButton}
                style={{ display: "inline-block" }}
                data-explanation-id="admin-instruction-view-usage"
              >
                🔍 View Instructions with This Image
              </button>
            </div>
          )}
          {showAnnotationEditor && item.content && (
            <ImageAnnotationEditor
              src={item.content}
              annotations={item.annotations ?? []}
              onChange={(annotations) => onUpdateAnnotations(index, annotations)}
              onClose={() => setShowAnnotationEditor(false)}
            />
          )}
          <ImageLibraryDialog
            isOpen={showImageLibrary}
            onClose={() => setShowImageLibrary(false)}
            onSelectImage={handleSelectFromLibrary}
            instructions={instructions}
            instructionsEn={instructionsEn}
            instructionsHe={instructionsHe}
            preSelectImageUrl={item.content}
            returnInstructionId={instructionId}
            returnContentIndex={index}
            returnLang={language}
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
  categoryValuesRaw,
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
  categoryValuesRaw: Array<{
    software: string | null;
    module: string | null;
    screen: string | null;
    item: string | null;
    keywords: string[];
  }>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedInstructionId, setSelectedInstructionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"default" | "link">("default");
  const [status, setStatus] = useState<"only title" | "partial explanation" | "full explanation">("only title");
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContentWithKey[]>([]);
  const [explanationFiles, setExplanationFiles] = useState<(File | null)[]>([]);
  const [isSavingWithUploads, setIsSavingWithUploads] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const { session } = useAuth();
  const [originalCode, setOriginalCode] = useState("");
  const fetcher = useFetcher<typeof action>();
  const saveFetcher = useFetcher<typeof action>();
  const deleteInstructionFetcher = useFetcher<typeof action>();
  const replaceInstructionFetcher = useFetcher<typeof action>();
  const duplicateInstructionFetcher = useFetcher<typeof action>();
  const [selectedContentIndex, setSelectedContentIndex] = useState<number | null>(null);
  const [instructionFilterEdit, setInstructionFilterEdit] = useState("");
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [replacementInstructionId, setReplacementInstructionId] = useState("");
  const [adminNotes, setAdminNotes] = useState<string[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const adminNotesFetcher = useFetcher<typeof action>();
  const [isCopied, setIsCopied] = useState(false);

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

  useEffect(() => {
    if (actionData?.success || selectedInstructionId) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
  }, [actionData, selectedInstructionId]);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem("admin-instructions-scroll");
    if (savedScroll !== null) {
      sessionStorage.removeItem("admin-instructions-scroll");
      const y = parseInt(savedScroll, 10);
      // Use requestAnimationFrame to wait for layout before restoring
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, []);

  useEffect(() => {
    if (actionData?.success && actionData.message && id) {
      const timer = setTimeout(() => {
        sessionStorage.setItem("admin-instructions-scroll", String(window.scrollY));
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${id}`;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [actionData, id, language]);

  useEffect(() => {
    if (saveFetcher.data && saveFetcher.state === "idle") {
      if (saveFetcher.data.success) {
        onChangesDetected(false);
        const timer = setTimeout(() => {
          sessionStorage.setItem("admin-instructions-scroll", String(window.scrollY));
          window.location.href = `/admin/instructions?lang=${language}&instructionId=${id}`;
        }, 1000);
        return () => clearTimeout(timer);
      } else if (saveFetcher.data.error) {
        alert(`Save failed: ${saveFetcher.data.error}`);
      }
    }
  }, [saveFetcher.data, saveFetcher.state, id, language]);

  useEffect(() => {
    const instructionIdFromUrl = searchParams.get("instructionId");
    const selectImage = searchParams.get("selectImage");
    const contentIndexParam = searchParams.get("contentIndex");

    if (
      instructionIdFromUrl &&
      allInstructionIds.includes(instructionIdFromUrl) &&
      selectedInstructionId !== instructionIdFromUrl
    ) {
      const imageOverride =
        selectImage !== null && contentIndexParam !== null && !isNaN(parseInt(contentIndexParam, 10))
          ? { index: parseInt(contentIndexParam, 10), url: selectImage }
          : undefined;

      updateFormFields(instructionIdFromUrl, imageOverride);

      if (selectImage) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("selectImage");
        newParams.delete("contentIndex");
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, allInstructionIds, selectedInstructionId]);

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      if (fetcher.data.success && fetcher.data.newInstructionId) {
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${fetcher.data.newInstructionId}`;
      } else if (fetcher.data.error) {
        alert(`Failed to create instruction: ${fetcher.data.error}`);
      }
    }
  }, [fetcher.data, fetcher.state, language]);

  useEffect(() => {
    if (duplicateInstructionFetcher.data && duplicateInstructionFetcher.state === "idle") {
      if (duplicateInstructionFetcher.data.success && duplicateInstructionFetcher.data.newInstructionId) {
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${duplicateInstructionFetcher.data.newInstructionId}`;
      } else if (duplicateInstructionFetcher.data.error) {
        alert(`Failed to duplicate instruction: ${duplicateInstructionFetcher.data.error}`);
      }
    }
  }, [duplicateInstructionFetcher.data, duplicateInstructionFetcher.state, language]);

  useEffect(() => {
    if (deleteInstructionFetcher.data && deleteInstructionFetcher.state === "idle") {
      if (deleteInstructionFetcher.data.success) {
        alert(deleteInstructionFetcher.data.message || "Instruction deleted successfully!");
        window.location.href = `/admin/instructions?lang=${language}`;
      } else if (deleteInstructionFetcher.data.error) {
        alert(`Failed to delete instruction: ${deleteInstructionFetcher.data.error}`);
      }
    }
  }, [deleteInstructionFetcher.data, deleteInstructionFetcher.state, language]);

  useEffect(() => {
    if (replaceInstructionFetcher.data && replaceInstructionFetcher.state === "idle") {
      if (replaceInstructionFetcher.data.success) {
        alert(replaceInstructionFetcher.data.message || "Instruction replaced successfully!");
        setShowReplaceDialog(false);
        setReplacementInstructionId("");
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${selectedInstructionId}`;
      } else if (replaceInstructionFetcher.data.error) {
        alert(`Failed to replace instruction: ${replaceInstructionFetcher.data.error}`);
      }
    }
  }, [replaceInstructionFetcher.data, replaceInstructionFetcher.state, language, selectedInstructionId]);

  const handleDuplicateInstruction = () => {
    if (!selectedInstructionId) {
      alert("Please select an instruction first");
      return;
    }
    onNavigationRequest(() => {
      const formData = new FormData();
      formData.append("actionType", "duplicateInstruction");
      formData.append("sourceInstructionId", selectedInstructionId);
      formData.append("language", language);
      formData.append("accessToken", session?.access_token || "");
      duplicateInstructionFetcher.submit(formData, { method: "post" });
    });
  };

  const handleAddNewInstruction = () => {
    onNavigationRequest(() => {
      const numericIds = allInstructionIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);
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
    if (!confirmDelete) return;
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
    if (!confirmReplace) return;
    const formData = new FormData();
    formData.append("actionType", "replaceInstruction");
    formData.append("oldInstructionId", selectedInstructionId);
    formData.append("newInstructionId", replacementInstructionId.trim());
    formData.append("accessToken", session?.access_token || "");
    replaceInstructionFetcher.submit(formData, { method: "post" });
  };

  const updateFormFields = (instructionId: string, imageOverride?: { index: number; url: string }) => {
    setSelectedInstructionId(instructionId);
    const instruction = instructions.find((i) => i.id === instructionId);
    // A title may be passed via URL when opening a freshly-created instruction
    // that was seeded from a temporary (Tx) entry's wording.
    const urlTitle = searchParams.get("title") || "";
    if (instruction) {
      setId(instruction.id);
      setTitle(instruction.title || urlTitle);
      setDescription(instruction.description || "");
      setType(instruction.type || "default");
      setStatus(instruction.status || "only title");
      setMissionId(instruction.missionId || "");
      const explanationWithKeys: InstructionContentWithKey[] = (instruction.explanation || []).map((item, idx) => ({
        ...item,
        content:
          imageOverride && idx === imageOverride.index && item.type === "image" ? imageOverride.url : item.content,
        _key: `content-${Date.now()}-${idx}-${Math.random()}`,
      }));
      setExplanation(explanationWithKeys);
      setExplanationFiles(new Array(explanationWithKeys.length).fill(null));
    } else {
      setId(instructionId);
      setTitle(urlTitle);
      setDescription("");
      setType("default");
      setStatus("only title");
      setMissionId("");
      setExplanation([]);
      setExplanationFiles([]);
    }
    setAdminNotes(adminNotesMap[instructionId] || []);
    setShowNoteInput(false);
    setNewNoteText("");
  };

  const handleSelectInstruction = (instructionId: string) => {
    updateFormFields(instructionId);
    // Update the URL so the instructionId is preserved when navigating back from preview.
    // Use replace so we don't push an extra history entry on every click.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (instructionId) {
          next.set("instructionId", instructionId);
        } else {
          next.delete("instructionId");
        }
        return next;
      },
      { replace: true },
    );
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
    while (updated.length <= index) updated.push(null);
    updated[index] = file;
    setExplanationFiles(updated);
  };

  const handleUpdateAnnotations = (index: number, annotations: Annotation[]) => {
    const updated = [...explanation];
    updated[index] = { ...updated[index], annotations };
    setExplanation(updated);
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

  const handleSaveWithUploads = async () => {
    if (!session) return;
    setIsSavingWithUploads(true);
    try {
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
        const response = await fetch("/admin", { method: "POST", body: formData });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Translation failed");
        return result.translatedText;
      });
      const translations = await Promise.all(translationPromises);
      let index = 0;
      const translatedTitle = translations[index++];
      const translatedDescription = description ? translations[index++] : "";
      const translatedExplanation = explanation.map((item) => {
        if (item.type === "text" && item.content) return { ...item, content: translations[index++] };
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

  const hasUnsavedChanges = selectedInstructionId && originalCode !== "" && generateCode() !== originalCode;

  const handleSilentSave = async (): Promise<void> => {
    if (!session || !selectedInstructionId) return;
    try {
      const currentCode = generateCode();
      const formData = new FormData();
      formData.append("actionType", "saveInstruction");
      formData.append("id", id);
      formData.append("dataEn", currentCode);
      formData.append("language", language);
      formData.append("accessToken", session.access_token || "");
      await fetch("/admin", { method: "POST", body: formData });
      setOriginalCode(currentCode);
      onChangesDetected(false);
    } catch {
      // fail silently — user can still pick an image
    }
  };

  const handleCopySelectedItem = async () => {
    if (selectedContentIndex === null) return;
    const item = explanation[selectedContentIndex];
    if (!item) return;
    const { _key, ...cleanItem } = item;
    const json = JSON.stringify(cleanItem, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      alert("Failed to copy to clipboard");
    }
  };

  const handlePasteContentItem = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        alert("Clipboard is empty.");
        return;
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        alert("Clipboard content is not valid JSON.");
        return;
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.type !== "string" ||
        typeof parsed.content !== "string"
      ) {
        alert('Clipboard JSON does not look like a content item. Expected an object with "type" and "content" fields.');
        return;
      }
      const newItem: InstructionContentWithKey = {
        ...(parsed as unknown as InstructionContent),
        _key: `content-${Date.now()}-${Math.random()}`,
      };
      // Insert after the selected index; fall back to end of list
      const insertAt = selectedContentIndex !== null ? selectedContentIndex + 1 : explanation.length;
      const updatedExplanation = [...explanation.slice(0, insertAt), newItem, ...explanation.slice(insertAt)];
      const updatedFiles = [...explanationFiles.slice(0, insertAt), null, ...explanationFiles.slice(insertAt)];
      setExplanation(updatedExplanation);
      setExplanationFiles(updatedFiles);
      setSelectedContentIndex(insertAt);

      // Scroll the pasted item into view after React re-renders
      setTimeout(() => {
        const el = document.querySelector(`[data-content-index="${insertAt}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } catch (error) {
      alert(`Failed to paste: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getMissionsForInstruction = (instructionId: string) => {
    return missions.filter((mission) => mission.instructions?.some(([id]) => id === instructionId));
  };

  const selectedInstructionMissions = selectedInstructionId ? getMissionsForInstruction(selectedInstructionId) : [];

  return (
    <div>
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
              data-explanation-id="admin-delete-instruction"
            >
              {deleteInstructionFetcher.state !== "idle" ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowReplaceDialog(true)}
              className={styles.addButton}
              disabled={!selectedInstructionId || !session}
              data-explanation-id="admin-replace-instruction-in-missions"
            >
              Replace In all missions
            </button>
            <button
              type="button"
              onClick={handleDuplicateInstruction}
              className={styles.addButton}
              disabled={!selectedInstructionId || duplicateInstructionFetcher.state !== "idle" || !session}
              data-explanation-id="admin-duplicate-instruction"
            >
              {duplicateInstructionFetcher.state !== "idle" ? "Duplicating..." : "⎘ Duplicate Instruction"}
            </button>
            <button
              type="button"
              onClick={handleAddNewInstruction}
              className={styles.addButton}
              disabled={fetcher.state !== "idle" || !session}
              data-explanation-id="admin-add-new-instruction"
            >
              {fetcher.state !== "idle" ? "Creating..." : "+ Add New Instruction"}
            </button>
          </div>
        </div>
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
                        <span
                          style={{
                            color:
                              instruction?.status === "full explanation"
                                ? "green"
                                : instruction?.status === "only title"
                                  ? "red"
                                  : "inherit",
                            fontWeight: 600,
                          }}
                        >
                          {id}
                        </span>
                        {instruction ? ` - ${instruction.title}` : " (No data for this language)"}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>

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
                          if (selectedInstructionId)
                            localStorage.setItem("lastSelectedInstructionId", selectedInstructionId);
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-2)",
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
                    onClick={handleCopySelectedItem}
                    className={styles.addButton}
                    disabled={selectedContentIndex === null}
                    title="Copy selected content item as JSON"
                    style={{ fontSize: "0.875rem" }}
                    data-explanation-id="admin-instruction-copy-json"
                  >
                    {isCopied ? "✓ Copied!" : "📋 Copy Selected"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteContentItem}
                    className={styles.addButton}
                    title="Paste content item from clipboard JSON — inserts after the selected item"
                    style={{ fontSize: "0.875rem" }}
                    data-explanation-id="admin-instruction-paste-json"
                  >
                    📥 Paste After Selected
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
                  onMoveUp={moveContentUp}
                  onMoveDown={moveContentDown}
                  canMoveUp={index > 0}
                  canMoveDown={index < explanation.length - 1}
                  instructions={instructions}
                  instructionsEn={instructionsEn}
                  instructionsHe={instructionsHe}
                  instructionId={selectedInstructionId}
                  language={language}
                  onNavigationRequest={onNavigationRequest}
                  imageFile={explanationFiles[index] ?? null}
                  onImageFileChange={handleImageFileChange}
                  onUpdateAnnotations={handleUpdateAnnotations}
                  hasUnsavedChanges={!!hasUnsavedChanges}
                  onSilentSave={handleSilentSave}
                  categoryValuesRaw={categoryValuesRaw}
                />
              ))}
              <div className={styles.addContentButtons}>
                <button
                  className={styles.addButton}
                  onClick={() => addContent("text")}
                  data-explanation-id="admin-instruction-add-text"
                >
                  + Add Text
                </button>
                <button
                  className={styles.addButton}
                  onClick={() => addContent("image")}
                  data-explanation-id="admin-instruction-add-image"
                >
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
                    <label className={styles.label}>Instruction ID </label>
                    <input
                      type="text"
                      className={styles.input}
                      value={id}
                      readOnly
                      style={{ cursor: "default", opacity: 0.65 }}
                      title="Instruction ID is read-only — assigned automatically by the system"
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
                        border:
                          editingNoteIndex === idx
                            ? "1px solid var(--color-accent-7)"
                            : "1px solid var(--color-neutral-6)",
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
                            style={{ flexShrink: 0, fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
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
                  setId(parsed.id || "");
                  setTitle(parsed.title || "");
                  setDescription(parsed.description || "");
                  setType(parsed.type || "default");
                  setStatus(parsed.status || "only title");
                  setMissionId(parsed.missionId || "");
                  const explanationWithKeys: InstructionContentWithKey[] = (parsed.explanation || []).map(
                    (item: InstructionContent, idx: number) => ({
                      ...item,
                      _key: `content-${Date.now()}-${idx}-${Math.random()}`,
                    }),
                  );
                  setExplanation(explanationWithKeys);
                } catch (err) {
                  // Invalid JSON — skip
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
                data-explanation-id="admin-instruction-translate"
              >
                {isTranslating ? "Translating..." : `Translate to ${language === "en" ? "Hebrew" : "English"} & Switch`}
              </button>
            </div>

            <div style={{ marginTop: "var(--space-4)" }}>
              <button
                type="button"
                className={styles.submitButton}
                disabled={!selectedInstructionId || !session || isSavingWithUploads || saveFetcher.state !== "idle"}
                onClick={handleSaveWithUploads}
                data-admin-primary-save="true"
                data-explanation-id="admin-instruction-save"
              >
                {isSavingWithUploads || saveFetcher.state !== "idle"
                  ? "Saving..."
                  : `Save to Database (${language === "he" ? "Hebrew" : "English"})`}
              </button>
            </div>

            {((actionData?.success && actionData.message) ||
              (saveFetcher.data?.success && saveFetcher.data.message)) && (
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
