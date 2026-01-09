import { useState, useEffect } from "react";
import { Form, useActionData, useNavigate } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { useAuth } from "~/hooks/use-auth";
import { initSupabase, getSupabase } from "~/lib/supabase";
import { uploadImage } from "~/lib/image-upload";
import type { Route } from "./+types/admin";
import styles from "./admin.module.css";
import { getAllInstructions, type Instruction, type InstructionContent } from "~/services/instructions.server";
import { getAllMissions, type Mission } from "~/services/missions.server";

export async function loader() {
  const [instructions, missions] = await Promise.all([
    getAllInstructions(),
    getAllMissions()
  ]);
  
  return {
    supabaseUrl: process.env.SUPABASE_PROJECT_URL!,
    supabaseKey: process.env.SUPABASE_API_KEY!,
    instructions,
    missions,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const id = formData.get("id") as string;
  const dataEn = formData.get("dataEn") as string;
  const dataHe = formData.get("dataHe") as string | null;
  const accessToken = formData.get("accessToken") as string | null;

  // Verify auth token is provided
  if (!accessToken) {
    return { success: false, error: 'Unauthorized: Authentication required' };
  }

  // Create authenticated Supabase client
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL!,
    process.env.SUPABASE_API_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  if (actionType === "saveInstruction") {
    const instructionData = JSON.parse(dataEn);
    
    const { error } = await supabase
      .from("instructions")
      .upsert({
        id,
        data_en: instructionData,
        data_he: dataHe ? JSON.parse(dataHe) : null,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      message: "Instruction saved successfully!"
    };
  } else if (actionType === "saveMission") {
    const missionData = JSON.parse(dataEn);
    
    const { error } = await supabase
      .from("missions")
      .upsert({
        id,
        data_en: missionData,
        data_he: dataHe ? JSON.parse(dataHe) : null,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      message: "Mission saved successfully!"
    };
  }

  return { success: false, error: "Invalid action type" };
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

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, 'instructions');
    setIsUploading(false);

    if ('error' in result) {
      alert(`Upload failed: ${result.error}`);
    } else {
      setImagePreview(result.url);
      onUpdate(index, result.url);
      alert('Image uploaded successfully!');
    }
  };

  return (
    <div className={styles.contentItem}>
      <div className={styles.contentItemHeader}>
        <span className={styles.contentItemType}>{item.type}</span>
        <button
          className={styles.removeButton}
          onClick={() => onRemove(index)}
        >
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
            <label className={styles.label}>Or Upload Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className={styles.input}
            />
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
                className={styles.addButton}
                style={{ marginTop: "var(--space-2)" }}
              >
                Upload to Supabase
              </button>
            )}
            {isUploading && (
              <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>
                Uploading...
              </p>
            )}
          </div>
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
  disabled
}: { 
  actionType: string; 
  id: string; 
  data: string; 
  disabled: boolean;
}) {
  const { session } = useAuth();
  
  return (
    <Form method="post" style={{ marginTop: "var(--space-4)" }}>
      <input type="hidden" name="actionType" value={actionType} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dataEn" value={data} />
      <input type="hidden" name="accessToken" value={session?.access_token || ""} />
      <button type="submit" className={styles.submitButton} disabled={disabled || !session}>
        Save to Database
      </button>
    </Form>
  );
}

export default function AdminPage({ loaderData }: Route.ComponentProps) {
  const { supabaseUrl, supabaseKey, instructions, missions } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  // Initialize Supabase on the client
  useEffect(() => {
    initSupabase(supabaseUrl, supabaseKey);
  }, [supabaseUrl, supabaseKey]);
  
  const clearActionData = () => {
    navigate("/admin", { replace: true });
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

              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSigningIn}
              >
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
            <span className={styles.userEmail}>{user.email}</span>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="instruction" className={styles.tabs}>
        <TabsList>
          <TabsTrigger value="instruction" onClick={() => clearActionData()}>New Instruction</TabsTrigger>
          <TabsTrigger value="edit-instruction" onClick={() => clearActionData()}>Edit Instruction</TabsTrigger>
          <TabsTrigger value="mission" onClick={() => clearActionData()}>New Mission</TabsTrigger>
          <TabsTrigger value="edit-mission" onClick={() => clearActionData()}>Edit Mission</TabsTrigger>
        </TabsList>

        <TabsContent value="instruction">
          <InstructionForm actionData={actionData} clearActionData={clearActionData} instructions={instructions} />
        </TabsContent>

        <TabsContent value="edit-instruction">
          <EditInstructionForm actionData={actionData} clearActionData={clearActionData} instructions={instructions} />
        </TabsContent>

        <TabsContent value="mission">
          <MissionForm actionData={actionData} clearActionData={clearActionData} instructions={instructions} missions={missions} />
        </TabsContent>

        <TabsContent value="edit-mission">
          <EditMissionForm actionData={actionData} clearActionData={clearActionData} instructions={instructions} missions={missions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstructionForm({ actionData, clearActionData, instructions }: { actionData?: { success: boolean; message?: string; error?: string; imageUrl?: string }; clearActionData: () => void; instructions: Instruction[] }) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"default" | "link">("default");
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContent[]>([]);
  const { session } = useAuth();

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
        
        <AuthenticatedForm actionType="saveInstruction" id={id} data={generateCode()} disabled={!id || !title} />
        
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

function EditInstructionForm({ actionData, clearActionData, instructions }: { actionData?: { success: boolean; message?: string; error?: string; imageUrl?: string }; clearActionData: () => void; instructions: Instruction[] }) {
  const [selectedInstructionId, setSelectedInstructionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"default" | "link">("default");
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContent[]>([]);
  const { session } = useAuth();

  const handleSelectInstruction = (instructionId: string) => {
    clearActionData();
    setSelectedInstructionId(instructionId);
    const instruction = instructions.find((i) => i.id === instructionId);
    if (instruction) {
      setId(instruction.id);
      setTitle(instruction.title);
      setType(instruction.type || "default");
      setMissionId(instruction.missionId || "");
      setExplanation(instruction.explanation || []);
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
      explanation,
      ...(type === "link" && { type, missionId }),
    };

    return JSON.stringify(instruction, null, 2);
  };

  return (
    <div>
      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Select Instruction to Edit</h2>
        <div className={styles.instructionCheckboxList}>
          {instructions.map((instruction) => (
            <label
              key={instruction.id}
              className={styles.checkboxLabel}
              style={{ cursor: "pointer" }}
            >
              <input
                type="radio"
                name="instruction"
                value={instruction.id}
                checked={selectedInstructionId === instruction.id}
                onChange={() => handleSelectInstruction(instruction.id)}
              />
              <span>
                {instruction.id} - {instruction.title}
              </span>
            </label>
          ))}
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
            <h2 className={styles.previewTitle}>Updated Code</h2>
            <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
              Copy this object and replace the existing instruction with ID "{id}" in <code>app/data/instructions.ts</code>
            </p>
            <pre className={styles.outputCode}>{generateCode()}</pre>
            
            <AuthenticatedForm actionType="saveInstruction" id={id} data={generateCode()} disabled={!id || !title} />
            
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
        </>
      )}
    </div>
  );
}

function EditMissionForm({ actionData, clearActionData, instructions, missions }: { actionData?: { success: boolean; message?: string; error?: string; imageUrl?: string }; clearActionData: () => void; instructions: Instruction[]; missions: Mission[] }) {
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const { session } = useAuth();

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

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, 'missions');
    setIsUploading(false);

    if ('error' in result) {
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
        <h2 className={styles.sectionTitle}>Select Mission to Edit</h2>
        <div className={styles.instructionCheckboxList}>
          {missions.map((mission) => (
            <label
              key={mission.id}
              className={styles.checkboxLabel}
              style={{ cursor: "pointer" }}
            >
              <input
                type="radio"
                name="mission"
                value={mission.id}
                checked={selectedMissionId === mission.id}
                onChange={() => handleSelectMission(mission.id)}
              />
              <span>
                {mission.id} - {mission.title}
              </span>
            </label>
          ))}
        </div>
      </div>

      {selectedMissionId && (
        <>
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
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className={styles.input}
              />
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
                <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>
                  Uploading...
                </p>
              )}
              {actionData?.imageUrl && (
                <p style={{ marginTop: "var(--space-2)", fontSize: "0.875rem", color: "var(--color-success-11)" }}>
                  Image URL: {actionData.imageUrl}
                </p>
              )}
            </div>
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Select Instructions</h2>
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
            <h2 className={styles.previewTitle}>Updated Code</h2>
            <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
              Copy this object and replace the existing mission with ID "{id}" in <code>app/data/missions.ts</code>
            </p>
            <pre className={styles.outputCode}>{generateCode()}</pre>
            
            <AuthenticatedForm actionType="saveMission" id={id} data={generateCode()} disabled={!id || !title} />
            
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
        </>
      )}
    </div>
  );
}

function MissionForm({ actionData, clearActionData, instructions, missions }: { actionData?: { success: boolean; message?: string; error?: string; imageUrl?: string }; clearActionData: () => void; instructions: Instruction[]; missions: Mission[] }) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const { session } = useAuth();

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

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, 'missions');
    setIsUploading(false);

    if ('error' in result) {
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
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className={styles.input}
          />
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
            <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>
              Uploading...
            </p>
          )}
          {actionData?.imageUrl && (
            <p style={{ marginTop: "var(--space-2)", fontSize: "0.875rem", color: "var(--color-success-11)" }}>
              Image URL: {actionData.imageUrl}
            </p>
          )}
        </div>
      </div>

      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Select Instructions</h2>
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
        
        <AuthenticatedForm actionType="saveMission" id={id} data={generateCode()} disabled={!id || !title} />
        
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
