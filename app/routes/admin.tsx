import { useState, useEffect } from "react";
import { Form, useActionData, useNavigate, useSearchParams, Link } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { useAuth } from "~/hooks/use-auth";
import { initSupabase, getSupabase } from "~/lib/supabase";
import { uploadImage, listAllImages } from "~/lib/image-upload";
import type { Route } from "./+types/admin";
import styles from "./admin.module.css";
import {
  getAllInstructions,
  getAllInstructionsHe,
  getAllInstructionIds,
  type Instruction,
  type InstructionContent,
} from "~/services/instructions.server";
import { getAllMissions, getAllMissionsHe, getAllMissionIds, type Mission } from "~/services/missions.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = url.searchParams.get("lang") || "en";
  const tab = url.searchParams.get("tab") || "instruction";

  const [instructions, missions, allInstructionIds, allMissionIds] = await Promise.all([
    language === "he" ? getAllInstructionsHe() : getAllInstructions(),
    language === "he" ? getAllMissionsHe() : getAllMissions(),
    getAllInstructionIds(),
    getAllMissionIds(),
  ]);

  return {
    supabaseUrl: process.env.SUPABASE_PROJECT_URL!,
    supabaseKey: process.env.SUPABASE_API_KEY!,
    instructions,
    missions,
    allInstructionIds,
    allMissionIds,
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

  // Handle create new mission action
  if (actionType === "createMission") {
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

    // Get all existing mission IDs
    const { data: existingMissions } = await supabase.from("missions").select("id").order("created_at", { ascending: true });

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
      instructionIds: [],
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
}) {
  const [images, setImages] = useState<Array<{ name: string; url: string; path: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadImages();
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

  if (!isOpen) return null;

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
          <div className={styles.imageGrid}>
            {images.map((image) => (
              <div
                key={image.path}
                className={styles.imageGridItem}
                onClick={() => {
                  onSelectImage(image.url);
                  onClose();
                }}
              >
                <img src={image.url} alt={image.name} className={styles.imageGridThumb} />
                <div className={styles.imageGridName}>{image.name}</div>
              </div>
            ))}
          </div>
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
}: {
  item: InstructionContent;
  index: number;
  onUpdate: (index: number, content: string) => void;
  onRemove: (index: number) => void;
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
      // Check clipboard permissions first
      const permissionStatus = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
      console.log("Clipboard permission:", permissionStatus.state);

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
          `Failed to read clipboard: ${errorMessage}\n\nTry:\n1. Copy an image to clipboard\n2. Make sure you\'re using a modern browser (Chrome, Edge, Firefox)\n3. If using a screenshot tool, ensure it copies to clipboard`,
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
      onUpdate(index, result.url);
      alert("Image uploaded successfully!");
    }
  };

  const handleSelectFromLibrary = (url: string) => {
    setImagePreview(url);
    onUpdate(index, url);
  };

  return (
    <div className={styles.contentItem}>
      <div className={styles.contentItemHeader}>
        <span className={styles.contentItemType}>{item.type}</span>
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
              <button type="button" onClick={handlePasteFromClipboard} className={styles.addButton}>
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
          <ImageLibraryDialog
            isOpen={showImageLibrary}
            onClose={() => setShowImageLibrary(false)}
            onSelectImage={handleSelectFromLibrary}
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
  const { supabaseUrl, supabaseKey, instructions, missions, allInstructionIds, allMissionIds, language, tab } =
    loaderData;
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState(tab);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

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
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>Developer Admin Panel</h1>
            <p className={styles.subtitle}>Create and manage instructions and missions</p>
          </div>
          <div className={styles.userInfo}>
            <Link to="/" className={styles.homeButton}>
              Go to Home
            </Link>
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
          <TabsTrigger value="instruction">New Instruction</TabsTrigger>
          <TabsTrigger value="edit-instruction">Edit Instruction</TabsTrigger>
          <TabsTrigger value="mission">New Mission</TabsTrigger>
          <TabsTrigger value="edit-mission">Edit Mission</TabsTrigger>
        </TabsList>

        <TabsContent value="instruction">
          <InstructionForm
            actionData={actionData}
            clearActionData={clearActionData}
            instructions={instructions}
            language={language}
            onChangesDetected={setHasUnsavedChanges}
            onNavigationRequest={handleNavigationWithCheck}
          />
        </TabsContent>

        <TabsContent value="edit-instruction">
          <EditInstructionForm
            actionData={actionData}
            clearActionData={clearActionData}
            instructions={instructions}
            allInstructionIds={allInstructionIds}
            language={language}
            onChangesDetected={setHasUnsavedChanges}
            onNavigationRequest={handleNavigationWithCheck}
          />
        </TabsContent>

        <TabsContent value="mission">
          <MissionForm
            actionData={actionData}
            clearActionData={clearActionData}
            instructions={instructions}
            missions={missions}
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

function InstructionForm({
  actionData,
  clearActionData,
  instructions,
  language,
  onChangesDetected,
  onNavigationRequest,
}: {
  actionData?: { success: boolean; message?: string; error?: string; imageUrl?: string };
  clearActionData: () => void;
  instructions: Instruction[];
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
}) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"default" | "link">("default");
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContent[]>([]);
  const { session } = useAuth();
  const [originalCode, setOriginalCode] = useState("");

  // Track changes
  useEffect(() => {
    const currentCode = generateCode();
    if (originalCode === "") {
      setOriginalCode(currentCode);
    } else {
      onChangesDetected(currentCode !== originalCode);
    }
  }, [id, title, description, type, missionId, explanation]);

  // Reset on save
  useEffect(() => {
    if (actionData?.success) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
  }, [actionData]);

  const addContent = (type: "text" | "image" | "video") => {
    setExplanation([...explanation, { type, content: "" }]);
  };

  const updateContent = (index: number, content: string) => {
    const updated = [...explanation];
    updated[index].content = content;
    setExplanation(updated);
  };

  const removeContent = (index: number) => {
    setExplanation(explanation.filter((_, i) => i !== index));
  };

  const generateCode = () => {
    const instruction: Instruction = {
      id,
      title,
      ...(description && { description }),
      explanation,
      ...(type === "link" && { type, missionId }),
    };

    return JSON.stringify(instruction, null, 2);
  };

  return (
    <div>
      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Instruction Details</h2>
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
            <label className={styles.label}>Title</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Getting Started with Advanced Features"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
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

          {type === "link" && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Target Mission ID</label>
              <input
                type="text"
                className={styles.input}
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
                placeholder="e.g., beginner-setup"
              />
              <small style={{ color: "var(--color-neutral-11)", fontSize: "0.875rem", marginTop: "var(--space-1)" }}>
                The mission ID to navigate to when this instruction is clicked
              </small>
            </div>
          )}
        </div>
      </div>

      {type === "default" && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Explanation Content</h2>

          {explanation.map((item, index) => (
            <ExplanationContentItem
              key={index}
              item={item}
              index={index}
              onUpdate={updateContent}
              onRemove={removeContent}
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
        <h2 className={styles.previewTitle}>Generated Code</h2>
        <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
          Copy this object and add it to the <code>instructions</code> array in <code>app/data/instructions.ts</code>
        </p>
        <pre className={styles.outputCode}>{generateCode()}</pre>

        <AuthenticatedForm
          actionType="saveInstruction"
          id={id}
          data={generateCode()}
          disabled={!id || !title}
          language={language}
        />

        {actionData?.success && (
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
    </div>
  );
}

function EditInstructionForm({
  actionData,
  clearActionData,
  instructions,
  allInstructionIds,
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
  allInstructionIds: string[];
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
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContent[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const [originalCode, setOriginalCode] = useState("");

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
  }, [id, title, description, type, missionId, explanation, selectedInstructionId]);

  // Reset on save or instruction change
  useEffect(() => {
    if (actionData?.success || selectedInstructionId) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
  }, [actionData, selectedInstructionId]);

  // Handle newly created instruction or URL parameter
  useEffect(() => {
    const instructionIdFromUrl = searchParams.get("instructionId");
    if (instructionIdFromUrl && allInstructionIds.includes(instructionIdFromUrl)) {
      handleSelectInstruction(instructionIdFromUrl);
    }
  }, [searchParams, allInstructionIds]);

  const handleAddNewInstruction = async () => {
    onNavigationRequest(async () => {
      setIsCreatingNew(true);

      try {
        // Find the highest ID from existing instructions
        const numericIds = allInstructionIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const newId = String(maxId + 1);

        // Create the new instruction via form submission
        const formData = new FormData();
        formData.append("actionType", "createInstruction");
        formData.append("newId", newId);
        formData.append("language", language);
        formData.append("accessToken", session?.access_token || "");

        const response = await fetch("/admin", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          alert(`Failed to create instruction: ${result.error}`);
          setIsCreatingNew(false);
          return;
        }

        // Reload the page to refresh the instruction list
        window.location.href = `/admin?tab=edit-instruction&lang=${language}`;
      } catch (error) {
        console.error("Error creating instruction:", error);
        alert(`Failed to create instruction: ${error instanceof Error ? error.message : "Unknown error"}`);
        setIsCreatingNew(false);
      }
    });
  };

  const handleSelectInstruction = (instructionId: string) => {
    clearActionData();
    setSelectedInstructionId(instructionId);
    const instruction = instructions.find((i) => i.id === instructionId);
    if (instruction) {
      setId(instruction.id);
      setTitle(instruction.title);
      setDescription(instruction.description || "");
      setType(instruction.type || "default");
      setMissionId(instruction.missionId || "");
      setExplanation(instruction.explanation || []);
    } else {
      // No data for this language, start with empty fields
      setId(instructionId);
      setTitle("");
      setDescription("");
      setType("default");
      setMissionId("");
      setExplanation([]);
    }
  };

  const addContent = (type: "text" | "image" | "video") => {
    setExplanation([...explanation, { type, content: "" }]);
  };

  const updateContent = (index: number, content: string) => {
    const updated = [...explanation];
    updated[index].content = content;
    setExplanation(updated);
  };

  const removeContent = (index: number) => {
    setExplanation(explanation.filter((_, i) => i !== index));
  };

  const generateCode = () => {
    const instruction: Instruction = {
      id,
      title,
      ...(description && { description }),
      explanation,
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

  return (
    <div>
      <div className={styles.formSection}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-3)",
          }}
        >
          <h2 className={styles.sectionTitle}>Select Instruction to Edit</h2>
          <button
            type="button"
            onClick={handleAddNewInstruction}
            className={styles.addButton}
            disabled={isCreatingNew || !session}
          >
            {isCreatingNew ? "Creating..." : "+ Add New Instruction"}
          </button>
        </div>
        <div className={styles.instructionCheckboxList}>
          {allInstructionIds.map((id) => {
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

      {selectedInstructionId && (
        <>
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Instruction Details</h2>
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
                <label className={styles.label}>Title</label>
                <input
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Getting Started with Advanced Features"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Description</label>
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

              {type === "link" && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Target Mission ID</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={missionId}
                    onChange={(e) => setMissionId(e.target.value)}
                    placeholder="e.g., beginner-setup"
                  />
                  <small
                    style={{ color: "var(--color-neutral-11)", fontSize: "0.875rem", marginTop: "var(--space-1)" }}
                  >
                    The mission ID to navigate to when this instruction is clicked
                  </small>
                </div>
              )}
            </div>
          </div>

          {type === "default" && (
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Explanation Content</h2>

              {explanation.map((item, index) => (
                <ExplanationContentItem
                  key={index}
                  item={item}
                  index={index}
                  onUpdate={updateContent}
                  onRemove={removeContent}
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
            <h2 className={styles.previewTitle}>Updated Code</h2>
            <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
              Copy this object and replace the existing instruction with ID "{id}" in{" "}
              <code>app/data/instructions.ts</code>
            </p>
            <pre className={styles.outputCode}>{generateCode()}</pre>

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
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
}) {
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [selectedInstructionForReorder, setSelectedInstructionForReorder] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { session } = useAuth();
  const [originalCode, setOriginalCode] = useState("");
  const [searchParams] = useSearchParams();

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
  }, [id, title, description, selectedInstructions, selectedMissionId]);

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
    if (missionIdFromUrl && allMissionIds.includes(missionIdFromUrl)) {
      handleSelectMission(missionIdFromUrl);
    }
  }, [searchParams, allMissionIds]);

  const handleAddNewInstruction = async () => {
    onNavigationRequest(async () => {
      setIsCreatingNew(true);

      try {
        // Use the already available allInstructionIds from props
        const allInstructionIdsResponse = await fetch(`/admin?lang=${language}`);
        const htmlText = await allInstructionIdsResponse.text();

        // We can't parse HTML as JSON, so we'll use the instructions from props
        // Get all instruction IDs from the instructions prop
        const allIds = instructions.map((i) => i.id);

        const numericIds = allIds.map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));

        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const newId = String(maxId + 1);

        // Create the new instruction via form submission
        const formData = new FormData();
        formData.append("actionType", "createInstruction");
        formData.append("newId", newId);
        formData.append("language", language);
        formData.append("accessToken", session?.access_token || "");

        const response = await fetch("/admin", {
          method: "POST",
          body: formData,
        });

        // The response might be HTML (redirect), so check content type
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (!result.success) {
            alert(`Failed to create instruction: ${result.error}`);
            setIsCreatingNew(false);
            return;
          }
        }

        // Navigate to edit-instruction tab with the new instruction selected
        window.location.href = `/admin?tab=edit-instruction&lang=${language}&instructionId=${newId}`;
      } catch (error) {
        console.error("Error creating instruction:", error);
        alert(`Failed to create instruction: ${error instanceof Error ? error.message : "Unknown error"}`);
        setIsCreatingNew(false);
      }
    });
  };

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
      console.log("Clipboard permission:", permissionStatus.state);

      const clipboardItems = await navigator.clipboard.read();
      console.log("Clipboard items count:", clipboardItems.length);

      for (const item of clipboardItems) {
        console.log("Available clipboard types:", item.types);

        const imageType = item.types.find((type) => type.startsWith("image/"));

        if (imageType) {
          console.log("Found image type:", imageType);
          const blob = await item.getType(imageType);
          console.log("Blob size:", blob.size, "bytes");

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
          `Failed to read clipboard: ${errorMessage}\n\nTry:\n1. Copy an image to clipboard\n2. Make sure you\'re using a modern browser (Chrome, Edge, Firefox)\n3. If using a screenshot tool, ensure it copies to clipboard`,
        );
      }
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, "missions");
    setIsUploading(false);

    if ("error" in result) {
      alert(`Upload failed: ${result.error}`);
    } else {
      setImagePreview(result.url);
      alert(`Image uploaded successfully! URL: ${result.url}`);
    }
  };

  const handleSelectMission = (missionId: string) => {
    clearActionData();
    setSelectedMissionId(missionId);
    const mission = missions.find((m) => m.id === missionId);
    if (mission) {
      setId(mission.id);
      setTitle(mission.title);
      setDescription(mission.description);
      setSelectedInstructions(mission.instructionIds);
    } else {
      // No data for this language, start with empty fields
      setId(missionId);
      setTitle("");
      setDescription("");
      setSelectedInstructions([]);
    }
  };

  const toggleInstruction = (instructionId: string) => {
    if (selectedInstructions.includes(instructionId)) {
      setSelectedInstructions(selectedInstructions.filter((id) => id !== instructionId));
      if (selectedInstructionForReorder === instructionId) {
        setSelectedInstructionForReorder(null);
      }
    } else {
      setSelectedInstructions([...selectedInstructions, instructionId]);
    }
  };

  const moveInstructionUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedInstructionForReorder) return;

    const index = selectedInstructions.indexOf(selectedInstructionForReorder);
    if (index <= 0) return; // Already at the top or not found

    const newOrder = [...selectedInstructions];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSelectedInstructions(newOrder);
  };

  const moveInstructionDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedInstructionForReorder) return;

    const index = selectedInstructions.indexOf(selectedInstructionForReorder);
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
      instructionIds: selectedInstructions,
    };

    return JSON.stringify(mission, null, 2);
  };

  const handleClearForNewMission = async () => {
    try {
      // Create the new mission via form submission
      const formData = new FormData();
      formData.append("actionType", "createMission");
      formData.append("accessToken", session?.access_token || "");

      const response = await fetch("/admin", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        alert(`Failed to create mission: ${result.error}`);
        return;
      }

      // Reload the page to refresh with the new mission selected
      window.location.href = `/admin?tab=edit-mission&lang=${language}&missionId=${result.newMissionId}`;
    } catch (error) {
      console.error("Error creating mission:", error);
      alert(`Failed to create mission: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

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

  return (
    <div>
      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Select Mission to Edit</h2>
        <div className={styles.instructionCheckboxList}>
          {allMissionIds.map((id) => {
            const mission = missions.find((m) => m.id === id);
            return (
              <label key={id} className={styles.checkboxLabel} style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name="mission"
                  value={id}
                  checked={selectedMissionId === id}
                  onChange={() => handleSelectMission(id)}
                />
                <span>
                  {id}
                  {mission ? ` - ${mission.title}` : " (No data for this language)"}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {selectedMissionId && (
        <>
          <div className={styles.formSection}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3)",
              }}
            >
              <h2 className={styles.sectionTitle}>Mission Details</h2>
              <button
                type="button"
                onClick={handleClearForNewMission}
                className={styles.addButton}
                disabled={!session}
              >
                Clear for New Mission
              </button>
            </div>
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
            </div>
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Mission Image (Optional)</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>Upload Image</label>
              <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <button type="button" onClick={handlePasteFromClipboard} className={styles.addButton}>
                  📋 Paste from Clipboard
                </button>
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} className={styles.input} />
              {imagePreview && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ maxWidth: "300px", borderRadius: "var(--radius-3)" }}
                  />
                </div>
              )}
              {imageFile && !isUploading && (
                <button
                  type="button"
                  onClick={handleImageUpload}
                  className={styles.addButton}
                  style={{ marginTop: "var(--space-3)" }}
                >
                  Upload Image to Supabase
                </button>
              )}
              {isUploading && (
                <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>Uploading...</p>
              )}
              {actionData?.imageUrl && (
                <p style={{ marginTop: "var(--space-2)", fontSize: "0.875rem", color: "var(--color-success-11)" }}>
                  Image URL: {actionData.imageUrl}
                </p>
              )}
            </div>
          </div>

          <div className={styles.formSection}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3)",
              }}
              className={styles.div1}
            >
              <h2 className={styles.sectionTitle}>Select Instructions</h2>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  onClick={moveInstructionUp}
                  className={styles.addButton}
                  disabled={
                    !selectedInstructionForReorder || selectedInstructions.indexOf(selectedInstructionForReorder) === 0
                  }
                  title="Move selected instruction up"
                >
                  ↑ Move Up
                </button>
                <button
                  type="button"
                  onClick={moveInstructionDown}
                  className={styles.addButton}
                  disabled={
                    !selectedInstructionForReorder ||
                    selectedInstructions.indexOf(selectedInstructionForReorder) === selectedInstructions.length - 1
                  }
                  title="Move selected instruction down"
                >
                  ↓ Move Down
                </button>
                <button
                  type="button"
                  onClick={handleAddNewInstruction}
                  className={styles.addButton}
                  disabled={isCreatingNew || !session}
                >
                  {isCreatingNew ? "Creating..." : "+ Add New Instruction"}
                </button>
              </div>
            </div>
            <div className={styles.instructionCheckboxList}>
              {/* First show selected instructions in order */}
              {selectedInstructions.map((instructionId) => {
                const instruction = instructions.find((i) => i.id === instructionId);
                if (!instruction) return null;
                return (
                  <label key={instruction.id} className={styles.checkboxLabel}>
                    <input
                      type="radio"
                      name="instructionForReorder"
                      checked={selectedInstructionForReorder === instruction.id}
                      onChange={() => setSelectedInstructionForReorder(instruction.id)}
                    />
                    <input type="checkbox" checked={true} onChange={() => toggleInstruction(instruction.id)} />
                    <span>
                      {instruction.id} - {instruction.title}
                    </span>
                  </label>
                );
              })}
              {/* Then show unselected instructions */}
              {instructions
                .filter((instruction) => !selectedInstructions.includes(instruction.id))
                .map((instruction) => (
                  <label key={instruction.id} className={styles.checkboxLabel}>
                    <input
                      type="radio"
                      name="instructionForReorder"
                      checked={false}
                      onChange={() => setSelectedInstructionForReorder(instruction.id)}
                      disabled={true}
                    />
                    <input type="checkbox" checked={false} onChange={() => toggleInstruction(instruction.id)} />
                    <span>
                      {instruction.id} - {instruction.title}
                    </span>
                  </label>
                ))}
            </div>
          </div>

          <div className={styles.previewSection}>
            <h2 className={styles.previewTitle}>Updated Code</h2>
            <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
              Copy this object and replace the existing mission with ID "{id}" in <code>app/data/missions.ts</code>
            </p>
            <pre className={styles.outputCode}>{generateCode()}</pre>

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
    </div>
  );
}

function MissionForm({
  actionData,
  clearActionData,
  instructions,
  missions,
  language,
  onChangesDetected,
  onNavigationRequest,
}: {
  actionData?: { success: boolean; message?: string; error?: string; imageUrl?: string };
  clearActionData: () => void;
  instructions: Instruction[];
  missions: Mission[];
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
}) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [selectedInstructionForReorder, setSelectedInstructionForReorder] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { session } = useAuth();
  const [originalCode, setOriginalCode] = useState("");

  // Track changes
  useEffect(() => {
    const currentCode = generateCode();
    if (originalCode === "") {
      setOriginalCode(currentCode);
    } else {
      onChangesDetected(currentCode !== originalCode);
    }
  }, [id, title, description, selectedInstructions]);

  // Reset on save
  useEffect(() => {
    if (actionData?.success) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
  }, [actionData]);

  const handleAddNewInstruction = async () => {
    onNavigationRequest(async () => {
      setIsCreatingNew(true);

      try {
        // Get all instruction IDs from the instructions prop
        const allIds = instructions.map((i) => i.id);

        const numericIds = allIds.map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));

        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const newId = String(maxId + 1);

        // Create the new instruction via form submission
        const formData = new FormData();
        formData.append("actionType", "createInstruction");
        formData.append("newId", newId);
        formData.append("language", language);
        formData.append("accessToken", session?.access_token || "");

        const response = await fetch("/admin", {
          method: "POST",
          body: formData,
        });

        // The response might be HTML (redirect), so check content type
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (!result.success) {
            alert(`Failed to create instruction: ${result.error}`);
            setIsCreatingNew(false);
            return;
          }
        }

        // Navigate to edit-instruction tab with the new instruction selected
        window.location.href = `/admin?tab=edit-instruction&lang=${language}&instructionId=${newId}`;
      } catch (error) {
        console.error("Error creating instruction:", error);
        alert(`Failed to create instruction: ${error instanceof Error ? error.message : "Unknown error"}`);
        setIsCreatingNew(false);
      }
    });
  };

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
      console.log("Clipboard permission:", permissionStatus.state);

      const clipboardItems = await navigator.clipboard.read();
      console.log("Clipboard items count:", clipboardItems.length);

      for (const item of clipboardItems) {
        console.log("Available clipboard types:", item.types);

        const imageType = item.types.find((type) => type.startsWith("image/"));

        if (imageType) {
          console.log("Found image type:", imageType);
          const blob = await item.getType(imageType);
          console.log("Blob size:", blob.size, "bytes");

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
          `Failed to read clipboard: ${errorMessage}\n\nTry:\n1. Copy an image to clipboard\n2. Make sure you\'re using a modern browser (Chrome, Edge, Firefox)\n3. If using a screenshot tool, ensure it copies to clipboard`,
        );
      }
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, "missions");
    setIsUploading(false);

    if ("error" in result) {
      alert(`Upload failed: ${result.error}`);
    } else {
      setImagePreview(result.url);
      alert(`Image uploaded successfully! URL: ${result.url}`);
    }
  };

  const toggleInstruction = (instructionId: string) => {
    if (selectedInstructions.includes(instructionId)) {
      setSelectedInstructions(selectedInstructions.filter((id) => id !== instructionId));
    } else {
      setSelectedInstructions([...selectedInstructions, instructionId]);
    }
  };

  const generateCode = () => {
    const mission: Mission = {
      id,
      title,
      description,
      instructionIds: selectedInstructions,
    };

    return JSON.stringify(mission, null, 2);
  };

  return (
    <div>
      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Mission Details</h2>
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
        </div>
      </div>

      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Mission Image (Optional)</h2>
        <div className={styles.formGroup}>
          <label className={styles.label}>Upload Image</label>
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
            <button type="button" onClick={handlePasteFromClipboard} className={styles.addButton}>
              📋 Paste from Clipboard
            </button>
          </div>
          <input type="file" accept="image/*" onChange={handleImageChange} className={styles.input} />
          {imagePreview && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <img src={imagePreview} alt="Preview" style={{ maxWidth: "300px", borderRadius: "var(--radius-3)" }} />
            </div>
          )}
          {imageFile && !isUploading && (
            <button
              type="button"
              onClick={handleImageUpload}
              className={styles.addButton}
              style={{ marginTop: "var(--space-3)" }}
            >
              Upload Image to Supabase
            </button>
          )}
          {isUploading && <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>Uploading...</p>}
          {actionData?.imageUrl && (
            <p style={{ marginTop: "var(--space-2)", fontSize: "0.875rem", color: "var(--color-success-11)" }}>
              Image URL: {actionData.imageUrl}
            </p>
          )}
        </div>
      </div>

      <div className={styles.formSection}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-3)",
          }}
        >
          <h2 className={styles.sectionTitle}>Select Instructions</h2>
          <button
            type="button"
            onClick={handleAddNewInstruction}
            className={styles.addButton}
            disabled={isCreatingNew || !session}
          >
            {isCreatingNew ? "Creating..." : "+ Add New Instruction"}
          </button>
        </div>
        <div className={styles.instructionCheckboxList}>
          {instructions.map((instruction) => (
            <label key={instruction.id} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedInstructions.includes(instruction.id)}
                onChange={() => toggleInstruction(instruction.id)}
              />
              <span>
                {instruction.id} - {instruction.title}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.previewSection}>
        <h2 className={styles.previewTitle}>Generated Code</h2>
        <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
          Copy this object and add it to the <code>missions</code> array in <code>app/data/missions.ts</code>
        </p>
        <pre className={styles.outputCode}>{generateCode()}</pre>

        <AuthenticatedForm
          actionType="saveMission"
          id={id}
          data={generateCode()}
          disabled={!id || !title}
          language={language}
        />

        {actionData?.success && (
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
    </div>
  );
}
