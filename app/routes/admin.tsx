import { useState, useEffect } from "react";
import { Form, useActionData } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { instructions, type Instruction, type InstructionContent } from "~/data/instructions";
import { missions, type Mission } from "~/data/missions";
import { useAuth } from "~/hooks/use-auth";
import { initSupabase, getSupabase } from "~/lib/supabase";
import type { Route } from "./+types/admin";
import styles from "./admin.module.css";

export async function loader() {
  return {
    supabaseUrl: process.env.SUPABASE_PROJECT_URL!,
    supabaseKey: process.env.SUPABASE_API_KEY!,
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
    const { error } = await supabase
      .from("instructions")
      .upsert({
        id,
        data_en: JSON.parse(dataEn),
        data_he: dataHe ? JSON.parse(dataHe) : null,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Instruction saved successfully!" };
  } else if (actionType === "saveMission") {
    const { error } = await supabase
      .from("missions")
      .upsert({
        id,
        data_en: JSON.parse(dataEn),
        data_he: dataHe ? JSON.parse(dataHe) : null,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Mission saved successfully!" };
  }

  return { success: false, error: "Invalid action type" };
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
  const { supabaseUrl, supabaseKey } = loaderData;
  const actionData = useActionData<typeof action>();
  
  // Initialize Supabase on the client
  useEffect(() => {
    initSupabase(supabaseUrl, supabaseKey);
  }, [supabaseUrl, supabaseKey]);
  
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
          <TabsTrigger value="instruction">New Instruction</TabsTrigger>
          <TabsTrigger value="edit-instruction">Edit Instruction</TabsTrigger>
          <TabsTrigger value="mission">New Mission</TabsTrigger>
          <TabsTrigger value="edit-mission">Edit Mission</TabsTrigger>
        </TabsList>

        <TabsContent value="instruction">
          <InstructionForm actionData={actionData} />
        </TabsContent>

        <TabsContent value="edit-instruction">
          <EditInstructionForm actionData={actionData} />
        </TabsContent>

        <TabsContent value="mission">
          <MissionForm actionData={actionData} />
        </TabsContent>

        <TabsContent value="edit-mission">
          <EditMissionForm actionData={actionData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstructionForm({ actionData }: { actionData?: { success: boolean; message?: string; error?: string } }) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"default" | "link">("default");
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContent[]>([]);

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
          <div key={index} className={styles.contentItem}>
            <div className={styles.contentItemHeader}>
              <span className={styles.contentItemType}>{item.type}</span>
              <button
                className={styles.removeButton}
                onClick={() => removeContent(index)}
              >
                Remove
              </button>
            </div>
            
            {item.type === "text" ? (
              <textarea
                className={styles.textarea}
                value={item.content}
                onChange={(e) => updateContent(index, e.target.value)}
                placeholder="Enter text content..."
              />
            ) : (
              <input
                type="text"
                className={styles.input}
                value={item.content}
                onChange={(e) => updateContent(index, e.target.value)}
                placeholder={`Enter ${item.type} URL...`}
              />
            )}
          </div>
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

function EditInstructionForm({ actionData }: { actionData?: { success: boolean; message?: string; error?: string } }) {
  const [selectedInstructionId, setSelectedInstructionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"default" | "link">("default");
  const [missionId, setMissionId] = useState("");
  const [explanation, setExplanation] = useState<InstructionContent[]>([]);

  const handleSelectInstruction = (instructionId: string) => {
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
              <div key={index} className={styles.contentItem}>
                <div className={styles.contentItemHeader}>
                  <span className={styles.contentItemType}>{item.type}</span>
                  <button
                    className={styles.removeButton}
                    onClick={() => removeContent(index)}
                  >
                    Remove
                  </button>
                </div>
                
                {item.type === "text" ? (
                  <textarea
                    className={styles.textarea}
                    value={item.content}
                    onChange={(e) => updateContent(index, e.target.value)}
                    placeholder="Enter text content..."
                  />
                ) : (
                  <input
                    type="text"
                    className={styles.input}
                    value={item.content}
                    onChange={(e) => updateContent(index, e.target.value)}
                    placeholder={`Enter ${item.type} URL...`}
                  />
                )}
              </div>
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

function EditMissionForm({ actionData }: { actionData?: { success: boolean; message?: string; error?: string } }) {
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);

  const handleSelectMission = (missionId: string) => {
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

function MissionForm({ actionData }: { actionData?: { success: boolean; message?: string; error?: string } }) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);

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
