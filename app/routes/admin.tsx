import { redirect } from "react-router";
import type { Route } from "./+types/admin";
import { getAllInstructions, getAllInstructionsHe, getAllInstructionIds } from "~/services/instructions.server";
import { getAllMissions, getAllMissionsHe, getAllMissionIds } from "~/services/missions.server";
import {
  getOrganizations,
  getAllUsers,
  getMissionOrganizations,
  setMissionOrganizations,
  setMissionExample,
  assignUserOrganization,
  createOrganization,
  deleteOrganization,
} from "~/services/organizations.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = url.searchParams.get("lang") || "en";
  const tab = url.searchParams.get("tab") || "edit-instruction";

  if (url.pathname === "/admin") {
    return redirect(`/admin/instructions?lang=${language}`);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);

  const [
    instructions,
    missions,
    allMissions,
    allMissionsHe,
    allInstructionIds,
    allMissionIds,
    instructionsEn,
    instructionsHe,
    organizations,
    users,
    adminNotesRows,
    missionAdminNotesRows,
  ] = await Promise.all([
    language === "he" ? getAllInstructionsHe() : getAllInstructions(),
    language === "he" ? getAllMissionsHe() : getAllMissions(),
    getAllMissions(),
    getAllMissionsHe(),
    getAllInstructionIds(),
    getAllMissionIds(),
    getAllInstructions(),
    getAllInstructionsHe(),
    getOrganizations(),
    getAllUsers(),
    adminClient.from("instructions").select("id, admin_notes"),
    adminClient.from("missions").select("id, admin_notes"),
  ]);

  const adminNotesMap: Record<string, string[]> = {};
  if (adminNotesRows.data) {
    for (const row of adminNotesRows.data) {
      adminNotesMap[row.id] = Array.isArray(row.admin_notes) ? row.admin_notes : [];
    }
  }

  const missionAdminNotesMap: Record<string, string[]> = {};
  if (missionAdminNotesRows.data) {
    for (const row of missionAdminNotesRows.data) {
      missionAdminNotesMap[row.id] = Array.isArray(row.admin_notes) ? row.admin_notes : [];
    }
  }

  const missionsWithAccess = await Promise.all(
    allMissions.map(async (m) => {
      const allowedOrgIds = await getMissionOrganizations(m.id);
      return { ...m, isExample: !!m.isExample, allowedOrgIds };
    }),
  );

  return {
    supabaseUrl: process.env.SUPABASE_PROJECT_URL!,
    supabaseKey: process.env.SUPABASE_API_KEY!,
    instructions,
    missions,
    allMissionsHe,
    allInstructionIds,
    allMissionIds,
    instructionsEn,
    instructionsHe,
    language,
    tab,
    organizations,
    users,
    missionsWithAccess,
    adminNotesMap,
    missionAdminNotesMap,
  };
}

export type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
  translatedText?: string | null;
  newInstructionId?: string;
  newMissionId?: string;
  deletedInstructionId?: string;
  deletedMissionId?: string;
  missionsUpdated?: number;
  importedMissionId?: string;
  importedInstructionCount?: number;
};

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const id = formData.get("id") as string;
  const dataEn = formData.get("dataEn") as string;
  const dataHe = formData.get("dataHe") as string | null;
  const language = formData.get("language") as string;
  const accessToken = formData.get("accessToken") as string | null;

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
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      const { data: newInstructionExists, error: checkError } = await supabase
        .from("instructions")
        .select("id")
        .eq("id", newInstructionId)
        .single();

      if (checkError || !newInstructionExists) {
        return { success: false, error: `New instruction ${newInstructionId} does not exist` };
      }

      const { data: allMissions, error: fetchError } = await supabase.from("missions").select("*");

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      let missionsUpdated = 0;

      if (allMissions && allMissions.length > 0) {
        const updatePromises = allMissions.map(async (missionRow: any) => {
          let updated = false;
          const updatedRow: any = { updated_at: new Date().toISOString() };

          if (missionRow.data_en && Array.isArray(missionRow.data_en.instructions)) {
            const updatedInstructions = missionRow.data_en.instructions.map((inst: [string, string?]) => {
              if (inst[0] === oldInstructionId) {
                return [newInstructionId, inst[1]] as [string, string?];
              }
              return inst;
            });
            if (JSON.stringify(updatedInstructions) !== JSON.stringify(missionRow.data_en.instructions)) {
              updatedRow.data_en = {
                ...missionRow.data_en,
                instructions: updatedInstructions,
              };
              updated = true;
            }
          }

          if (missionRow.data_en && Array.isArray(missionRow.data_en.instructionIds)) {
            const updatedInstructionIds = missionRow.data_en.instructionIds.map((instId: string) => {
              if (instId === oldInstructionId) {
                return newInstructionId;
              }
              return instId;
            });
            if (JSON.stringify(updatedInstructionIds) !== JSON.stringify(missionRow.data_en.instructionIds)) {
              updatedRow.data_en = {
                ...missionRow.data_en,
                instructionIds: updatedInstructionIds,
              };
              updated = true;
            }
          }

          if (missionRow.data_he && Array.isArray(missionRow.data_he.instructions)) {
            const updatedInstructions = missionRow.data_he.instructions.map((inst: [string, string?]) => {
              if (inst[0] === oldInstructionId) {
                return [newInstructionId, inst[1]] as [string, string?];
              }
              return inst;
            });
            if (JSON.stringify(updatedInstructions) !== JSON.stringify(missionRow.data_he.instructions)) {
              updatedRow.data_he = {
                ...missionRow.data_he,
                instructions: updatedInstructions,
              };
              updated = true;
            }
          }

          if (missionRow.data_he && Array.isArray(missionRow.data_he.instructionIds)) {
            const updatedInstructionIds = missionRow.data_he.instructionIds.map((instId: string) => {
              if (instId === oldInstructionId) {
                return newInstructionId;
              }
              return instId;
            });
            if (JSON.stringify(updatedInstructionIds) !== JSON.stringify(missionRow.data_he.instructionIds)) {
              updatedRow.data_he = {
                ...missionRow.data_he,
                instructionIds: updatedInstructionIds,
              };
              updated = true;
            }
          }

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
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      const { data: allMissions, error: fetchError } = await supabase.from("missions").select("*");

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      if (allMissions && allMissions.length > 0) {
        const updatePromises = allMissions.map(async (missionRow: any) => {
          let updated = false;
          const updatedRow: any = { updated_at: new Date().toISOString() };

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

          if (updated) {
            await supabase.from("missions").update(updatedRow).eq("id", missionRow.id);
          }
        });

        await Promise.all(updatePromises);
      }

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
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

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

  if (actionType === "createMissionWithInstructions") {
    const accessToken = formData.get("accessToken") as string | null;
    const instructionsJson = formData.get("instructions") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      const { data: existingMissions, error: fetchError } = await supabase
        .from("missions")
        .select("id")
        .order("created_at", { ascending: true });

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      const numericIds = (existingMissions || [])
        .map((m: any) => parseInt(m.id, 10))
        .filter((id: number) => !isNaN(id));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);

      let instructions: Array<[string, string?]> = [];
      try {
        instructions = instructionsJson ? JSON.parse(instructionsJson) : [];
      } catch {
        instructions = [];
      }

      const newMission = {
        id: newId,
        title: "",
        description: "",
        instructions,
      };

      const insertData: any = {
        id: newId,
        data_en: newMission,
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
        message: `New mission ${newId} created with imported instructions!`,
        newMissionId: newId,
      };
    } catch (error) {
      console.error("Error in createMissionWithInstructions:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "createMission") {
    const accessToken = formData.get("accessToken") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      const { data: existingMissions, error: fetchError } = await supabase
        .from("missions")
        .select("id")
        .order("created_at", { ascending: true });

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      const numericIds = (existingMissions || [])
        .map((m: any) => parseInt(m.id, 10))
        .filter((id: number) => !isNaN(id));

      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);

      const emptyMission = {
        id: newId,
        title: "",
        description: "",
        instructions: [],
      };

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

  if (actionType === "duplicateMission") {
    const accessToken = formData.get("accessToken") as string | null;
    const sourceMissionId = formData.get("sourceMissionId") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }
    if (!sourceMissionId) {
      return { success: false, error: "Source mission ID is required" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // Fetch the source mission row in full
      const { data: sourceRow, error: fetchError } = await supabase
        .from("missions")
        .select("data_en, data_he, is_example, admin_notes")
        .eq("id", sourceMissionId)
        .single();

      if (fetchError || !sourceRow) {
        return { success: false, error: fetchError?.message || "Source mission not found" };
      }

      // Generate next numeric ID
      const { data: existingMissions, error: listError } = await supabase
        .from("missions")
        .select("id")
        .order("created_at", { ascending: true });

      if (listError) {
        return { success: false, error: listError.message };
      }

      const numericIds = (existingMissions || [])
        .map((m: any) => parseInt(m.id, 10))
        .filter((n: number) => !isNaN(n));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);

      // Deep-copy and update id inside data_en / data_he payloads
      const newDataEn = sourceRow.data_en ? { ...sourceRow.data_en, id: newId } : null;
      const newDataHe = sourceRow.data_he ? { ...sourceRow.data_he, id: newId } : null;

      const insertData: any = {
        id: newId,
        data_en: newDataEn,
        data_he: newDataHe,
        is_example: sourceRow.is_example ?? false,
        admin_notes: sourceRow.admin_notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from("missions").insert(insertData);

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return {
        success: true,
        message: `Mission duplicated as ${newId}!`,
        newMissionId: newId,
      };
    } catch (error) {
      console.error("Error in duplicateMission:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "importMissionBundle") {
    const accessToken = formData.get("accessToken") as string | null;
    const bundleJson = formData.get("bundle") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }
    if (!bundleJson) {
      return { success: false, error: "No bundle data provided" };
    }

    let bundle: {
      mission: { id: string; title: string; description: string; instructions: Array<[string, string?]>; status?: string; isExample?: boolean };
      missionHe?: { id: string; title: string; description: string; instructions: Array<[string, string?]>; status?: string };
      instructionsEn: Array<{ id: string; [key: string]: unknown }>;
      instructionsHe: Array<{ id: string; [key: string]: unknown }>;
    };

    try {
      bundle = JSON.parse(bundleJson);
    } catch {
      return { success: false, error: "Invalid JSON in bundle file" };
    }

    if (!bundle.mission?.id) {
      return { success: false, error: "Bundle is missing mission data" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      const missionId = bundle.mission.id;

      // Upsert instructions (EN)
      for (const instrEn of bundle.instructionsEn || []) {
        const instrId = instrEn.id;
        const { data: existing } = await supabase.from("instructions").select("id").eq("id", instrId).single();
        if (existing) {
          await supabase.from("instructions").update({ data_en: instrEn, updated_at: new Date().toISOString() }).eq("id", instrId);
        } else {
          await supabase.from("instructions").insert({ id: instrId, data_en: instrEn, data_he: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        }
      }

      // Upsert instructions (HE) — only update data_he on rows that already exist
      for (const instrHe of bundle.instructionsHe || []) {
        const instrId = instrHe.id;
        const { data: existing } = await supabase.from("instructions").select("id").eq("id", instrId).single();
        if (existing) {
          await supabase.from("instructions").update({ data_he: instrHe, updated_at: new Date().toISOString() }).eq("id", instrId);
        } else {
          await supabase.from("instructions").insert({ id: instrId, data_en: null, data_he: instrHe, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        }
      }

      const importedInstructionCount = (bundle.instructionsEn || []).length;

      // Upsert mission
      const { data: existingMission } = await supabase.from("missions").select("id").eq("id", missionId).single();
      const missionPayload = {
        id: bundle.mission.id,
        title: bundle.mission.title,
        description: bundle.mission.description,
        instructions: bundle.mission.instructions,
        status: bundle.mission.status,
      };

      const missionHePayload = bundle.missionHe
        ? {
            id: bundle.missionHe.id,
            title: bundle.missionHe.title,
            description: bundle.missionHe.description,
            instructions: bundle.missionHe.instructions,
            status: bundle.missionHe.status,
          }
        : undefined;

      if (existingMission) {
        const updateData: Record<string, unknown> = { data_en: missionPayload, updated_at: new Date().toISOString() };
        if (missionHePayload) updateData.data_he = missionHePayload;
        if (bundle.mission.isExample !== undefined) updateData.is_example = bundle.mission.isExample;
        const { error } = await supabase.from("missions").update(updateData).eq("id", missionId);
        if (error) return { success: false, error: error.message };
      } else {
        const insertData: Record<string, unknown> = {
          id: missionId,
          data_en: missionPayload,
          data_he: missionHePayload ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (bundle.mission.isExample !== undefined) insertData.is_example = bundle.mission.isExample;
        const { error } = await supabase.from("missions").insert(insertData);
        if (error) return { success: false, error: error.message };
      }

      return {
        success: true,
        message: `Imported mission "${missionId}" with ${importedInstructionCount} instruction(s) successfully!`,
        importedMissionId: missionId,
        importedInstructionCount,
      };
    } catch (error) {
      console.error("Error in importMissionBundle:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "createInstruction") {
    const newId = formData.get("newId") as string;
    const targetLanguage = formData.get("language") as string;
    const accessToken = formData.get("accessToken") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: existingData } = await supabase.from("instructions").select("id").eq("id", newId).single();

    if (existingData) {
      return { success: false, error: `Instruction with ID ${newId} already exists` };
    }

    const emptyInstruction = {
      id: newId,
      title: "",
      explanation: [],
    };

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

  if (actionType === "createOrganization") {
    const name = formData.get("name") as string | null;
    const slug = formData.get("slug") as string | null;
    if (!accessToken) return { success: false, error: "Unauthorized" };
    if (!name) return { success: false, error: "Name is required" };
    const result = await createOrganization(name, slug || name.toLowerCase().replace(/\s+/g, "-"), accessToken);
    return result;
  }

  if (actionType === "deleteOrganization") {
    const organizationId = formData.get("organizationId") as string | null;
    if (!accessToken) return { success: false, error: "Unauthorized" };
    if (!organizationId) return { success: false, error: "Organization ID is required" };
    const result = await deleteOrganization(organizationId, accessToken);
    return result;
  }

  if (actionType === "assignUserOrg") {
    const userId = formData.get("userId") as string | null;
    const organizationId = formData.get("organizationId") as string | null;
    if (!accessToken) return { success: false, error: "Unauthorized" };
    if (!userId) return { success: false, error: "User ID is required" };
    const result = await assignUserOrganization(userId, organizationId || null);
    return result;
  }

  if (actionType === "setMissionAccess") {
    const missionId = formData.get("missionId") as string | null;
    const isExample = formData.get("isExample") === "true";
    const orgIdsRaw = formData.get("organizationIds") as string | null;
    if (!accessToken) return { success: false, error: "Unauthorized" };
    if (!missionId) return { success: false, error: "Mission ID is required" };
    const orgIds: string[] = orgIdsRaw ? JSON.parse(orgIdsRaw) : [];
    const token = accessToken!;
    const [exampleResult, orgResult] = await Promise.all([
      setMissionExample(missionId, isExample, token),
      setMissionOrganizations(missionId, orgIds, token),
    ]);
    if (!exampleResult.success) return exampleResult;
    if (!orgResult.success) return orgResult;
    return { success: true, message: "Mission access updated" };
  }

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

  if (!accessToken) {
    return { success: false, error: "Unauthorized: Authentication required" };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  if (actionType === "saveAdminNote") {
    const instructionId = formData.get("instructionId") as string;
    const notesJson = formData.get("notes") as string;

    if (!instructionId) {
      return { success: false, error: "Instruction ID is required" };
    }

    let notes: string[];
    try {
      notes = JSON.parse(notesJson);
    } catch {
      return { success: false, error: "Invalid notes format" };
    }

    const { error } = await supabase.from("instructions").update({ admin_notes: notes }).eq("id", instructionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Admin notes saved!" };
  }

  if (actionType === "saveMissionAdminNote") {
    const missionId = formData.get("missionId") as string;
    const notesJson = formData.get("notes") as string;

    if (!missionId) {
      return { success: false, error: "Mission ID is required" };
    }

    let notes: string[];
    try {
      notes = JSON.parse(notesJson);
    } catch {
      return { success: false, error: "Invalid notes format" };
    }

    const { error } = await supabase.from("missions").update({ admin_notes: notes }).eq("id", missionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Admin notes saved!" };
  }

  if (actionType === "saveInstruction") {
    const instructionData = JSON.parse(dataEn);

    const { data: existingData } = await supabase.from("instructions").select("id").eq("id", id).single();

    if (!existingData) {
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
    const isExampleRaw = formData.get("isExample");
    const isExample = isExampleRaw !== null ? isExampleRaw === "true" : undefined;

    const { data: existingData } = await supabase.from("missions").select("id").eq("id", id).single();

    if (!existingData) {
      const insertData: any = {
        id,
        data_en: language === "en" ? missionData : {},
        data_he: language === "he" ? missionData : null,
        updated_at: new Date().toISOString(),
      };
      if (isExample !== undefined) {
        insertData.is_example = isExample;
      }

      const { error } = await supabase.from("missions").insert(insertData);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (language === "he") {
        updateData.data_he = missionData;
      } else {
        updateData.data_en = missionData;
      }
      if (isExample !== undefined) {
        updateData.is_example = isExample;
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

export default function AdminCompatibilityRoute() {
  return null;
}