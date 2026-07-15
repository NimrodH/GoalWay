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

  const { getAllCategoryValues } = await import("~/services/image-keywords.server");

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
    categoryValuesRaw,
  ] = await Promise.all([
    language === "he" ? getAllInstructionsHe(true) : getAllInstructions(true),
    language === "he" ? getAllMissionsHe(true) : getAllMissions(true),
    getAllMissions(true),
    getAllMissionsHe(true),
    getAllInstructionIds(true),
    getAllMissionIds(true),
    getAllInstructions(true),
    getAllInstructionsHe(true),
    getOrganizations(),
    getAllUsers(),
    adminClient.from("instructions").select("id, admin_notes").eq("is_temp", false),
    adminClient.from("missions").select("id, admin_notes").eq("is_temp", false),
    getAllCategoryValues(),
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
      // Temp missions have no org access — skip the DB call
      const allowedOrgIds = m.isTemp ? [] : await getMissionOrganizations(m.id);
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
    categoryValuesRaw,
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
  /** Returned by startTestMode — the new temp mission's ID */
  tempMissionId?: string;
  /** Returned by publishTestMode / discardTestMode — the original mission's ID */
  sourceMissionId?: string;
  /** Returned by createTempInstructionCopies — map of originalId → tempId */
  idMap?: Record<string, string>;
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

  // ─── Test Mode ────────────────────────────────────────────────────────────

  if (actionType === "startTestMode") {
    const accessToken = formData.get("accessToken") as string | null;
    const sourceMissionId = formData.get("sourceMissionId") as string | null;

    if (!accessToken) return { success: false, error: "Unauthorized: Authentication required" };
    if (!sourceMissionId) return { success: false, error: "Source mission ID is required" };

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // 1. Enforce one temp mission at a time
      const { data: existingTemp } = await supabase
        .from("missions")
        .select("id")
        .eq("is_temp", true)
        .limit(1);
      if (existingTemp && existingTemp.length > 0) {
        return {
          success: false,
          error: `A test session already exists (mission ${existingTemp[0].id}). Please publish or discard it first.`,
        };
      }

      // 2. Fetch the source mission
      const { data: sourceRow, error: fetchError } = await supabase
        .from("missions")
        .select("data_en, data_he, is_example, admin_notes")
        .eq("id", sourceMissionId)
        .single();

      if (fetchError || !sourceRow) {
        return { success: false, error: fetchError?.message || "Source mission not found" };
      }

      // 3. Collect unique real instruction IDs from both data_en and data_he
      const specialPrefixes = ["if-", "end-if-", "else-", "comment-"];
      const isTempId = (id: string) => id.startsWith("T") && /^T\d+$/.test(id);
      const isSpecial = (id: string) =>
        isTempId(id) || specialPrefixes.some((p) => id.startsWith(p)) || id === "0";

      const collectIds = (instructions: Array<[string, string?]> = []) =>
        instructions
          .map(([id]) => (id.includes("#") ? id.split("#")[0] : id))
          .filter((id) => !isSpecial(id));

      const enIds = collectIds(sourceRow.data_en?.instructions);
      const heIds = collectIds(sourceRow.data_he?.instructions);
      const allOrigInstrIds = Array.from(new Set([...enIds, ...heIds]));

      // 4. Generate new numeric IDs for temp instructions
      const { data: allInstrRows } = await supabase.from("instructions").select("id");
      const instrNumericIds = (allInstrRows || []).map((r: any) => parseInt(r.id, 10)).filter((n: number) => !isNaN(n));
      let nextInstrId = (instrNumericIds.length > 0 ? Math.max(...instrNumericIds) : 0) + 1;

      // origId → tempId
      const instrIdMap = new Map<string, string>();
      for (const origId of allOrigInstrIds) {
        instrIdMap.set(origId, String(nextInstrId++));
      }

      // 5. Fetch and duplicate the source instructions
      if (allOrigInstrIds.length > 0) {
        const { data: srcInstrs } = await supabase
          .from("instructions")
          .select("id, data_en, data_he, admin_notes")
          .in("id", allOrigInstrIds);

        for (const srcInstr of srcInstrs || []) {
          const tempInstrId = instrIdMap.get(srcInstr.id)!;
          const newDataEn = srcInstr.data_en ? { ...srcInstr.data_en, id: tempInstrId } : null;
          const newDataHe = srcInstr.data_he ? { ...srcInstr.data_he, id: tempInstrId } : null;
          await supabase.from("instructions").insert({
            id: tempInstrId,
            data_en: newDataEn,
            data_he: newDataHe,
            is_temp: true,
            source_instruction_id: srcInstr.id,
            admin_notes: srcInstr.admin_notes ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      // 6. Generate a new ID for the temp mission
      const { data: allMissionRows } = await supabase.from("missions").select("id");
      const missionNumericIds = (allMissionRows || []).map((r: any) => parseInt(r.id, 10)).filter((n: number) => !isNaN(n));
      const tempMissionId = String((missionNumericIds.length > 0 ? Math.max(...missionNumericIds) : 0) + 1);

      // 7. Remap instruction IDs in the mission arrays
      const remapInstructions = (instructions: Array<[string, string?]> = []): Array<[string, string?]> =>
        instructions.map(([id, title]) => {
          const baseId = id.includes("#") ? id.split("#")[0] : id;
          const suffix = id.includes("#") ? "#" + id.split("#")[1] : "";
          const mappedId = instrIdMap.has(baseId) ? instrIdMap.get(baseId)! + suffix : id;
          return title !== undefined ? [mappedId, title] : [mappedId];
        });

      const newDataEn = sourceRow.data_en
        ? {
            ...sourceRow.data_en,
            id: tempMissionId,
            instructions: remapInstructions(sourceRow.data_en.instructions),
          }
        : null;

      const newDataHe = sourceRow.data_he
        ? {
            ...sourceRow.data_he,
            id: tempMissionId,
            instructions: remapInstructions(sourceRow.data_he.instructions),
          }
        : null;

      const { error: insertError } = await supabase.from("missions").insert({
        id: tempMissionId,
        data_en: newDataEn,
        data_he: newDataHe,
        is_temp: true,
        source_mission_id: sourceMissionId,
        is_example: false,
        admin_notes: sourceRow.admin_notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return {
        success: true,
        message: `Test session started as mission ${tempMissionId}.`,
        tempMissionId,
      };
    } catch (error) {
      console.error("Error in startTestMode:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "createTempInstructionCopies") {
    const accessToken = formData.get("accessToken") as string | null;
    const instructionIdsRaw = formData.get("instructionIds") as string | null;

    if (!accessToken) return { success: false, error: "Unauthorized: Authentication required" };
    if (!instructionIdsRaw) return { success: false, error: "No instruction IDs provided" };

    const instructionIds = instructionIdsRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // Determine the next available numeric instruction ID
      const { data: allInstrRows } = await supabase.from("instructions").select("id");
      const instrNumericIds = (allInstrRows || [])
        .map((r: any) => parseInt(r.id, 10))
        .filter((n: number) => !isNaN(n));
      let nextId = (instrNumericIds.length > 0 ? Math.max(...instrNumericIds) : 0) + 1;

      // Fetch each source instruction (only real, non-temp ones)
      const { data: srcInstrs, error: fetchErr } = await supabase
        .from("instructions")
        .select("id, data_en, data_he, admin_notes")
        .in("id", instructionIds)
        .eq("is_temp", false);

      if (fetchErr) return { success: false, error: fetchErr.message };

      const idMap: Record<string, string> = {};

      for (const srcInstr of srcInstrs || []) {
        const tempId = String(nextId++);
        idMap[srcInstr.id] = tempId;

        const newDataEn = srcInstr.data_en ? { ...srcInstr.data_en, id: tempId } : null;
        const newDataHe = srcInstr.data_he ? { ...srcInstr.data_he, id: tempId } : null;

        const { error: insertErr } = await supabase.from("instructions").insert({
          id: tempId,
          data_en: newDataEn,
          data_he: newDataHe,
          is_temp: true,
          source_instruction_id: srcInstr.id,
          admin_notes: srcInstr.admin_notes ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertErr) {
          return {
            success: false,
            error: `Failed to create temp copy for instruction ${srcInstr.id}: ${insertErr.message}`,
          };
        }
      }

      return { success: true, idMap };
    } catch (error) {
      console.error("Error in createTempInstructionCopies:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "discardTempInstruction") {
    const accessToken = formData.get("accessToken") as string | null;
    const instructionId = formData.get("instructionId") as string | null;

    if (!accessToken) return { success: false, error: "Unauthorized: Authentication required" };
    if (!instructionId) return { success: false, error: "Instruction ID is required" };

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // Verify this is a temp instruction before deleting
      const { data: row, error: fetchErr } = await supabase
        .from("instructions")
        .select("id, source_instruction_id, is_temp")
        .eq("id", instructionId)
        .eq("is_temp", true)
        .single();

      if (fetchErr || !row) {
        return { success: false, error: fetchErr?.message || "Temp instruction not found or not a temp copy" };
      }

      const { error: deleteErr } = await supabase
        .from("instructions")
        .delete()
        .eq("id", instructionId)
        .eq("is_temp", true);

      if (deleteErr) return { success: false, error: deleteErr.message };

      return { success: true };
    } catch (error) {
      console.error("Error in discardTempInstruction:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "publishTestMode") {
    const accessToken = formData.get("accessToken") as string | null;
    const tempMissionId = formData.get("tempMissionId") as string | null;

    if (!accessToken) return { success: false, error: "Unauthorized: Authentication required" };
    if (!tempMissionId) return { success: false, error: "Temp mission ID is required" };

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // 1. Fetch the temp mission
      const { data: tempRow, error: fetchErr } = await supabase
        .from("missions")
        .select("data_en, data_he, source_mission_id")
        .eq("id", tempMissionId)
        .eq("is_temp", true)
        .single();

      if (fetchErr || !tempRow) {
        return { success: false, error: fetchErr?.message || "Temp mission not found" };
      }

      const sourceMissionId = tempRow.source_mission_id as string;

      // 2. Collect all temp instruction IDs (base IDs only)
      const specialPrefixes = ["if-", "end-if-", "else-", "comment-"];
      const isTempId = (id: string) => id.startsWith("T") && /^T\d+$/.test(id);
      const isSpecial = (id: string) =>
        isTempId(id) || specialPrefixes.some((p) => id.startsWith(p)) || id === "0";

      const collectIds = (instructions: Array<[string, string?]> = []) =>
        instructions
          .map(([id]) => (id.includes("#") ? id.split("#")[0] : id))
          .filter((id) => !isSpecial(id));

      const tempInstrIds = Array.from(
        new Set([...collectIds(tempRow.data_en?.instructions), ...collectIds(tempRow.data_he?.instructions)]),
      );

      // 3. Fetch all temp instructions and build tempId → sourceId map
      const tempToSourceMap = new Map<string, string>();
      if (tempInstrIds.length > 0) {
        const { data: tempInstrs } = await supabase
          .from("instructions")
          .select("id, data_en, data_he, source_instruction_id")
          .in("id", tempInstrIds)
          .eq("is_temp", true);

        for (const ti of tempInstrs || []) {
          const srcId = ti.source_instruction_id as string;
          tempToSourceMap.set(ti.id, srcId);

          // Write temp instruction data back to the source instruction
          const updateInstrData: any = { updated_at: new Date().toISOString() };
          if (ti.data_en) updateInstrData.data_en = { ...ti.data_en, id: srcId };
          if (ti.data_he) updateInstrData.data_he = { ...ti.data_he, id: srcId };
          await supabase.from("instructions").update(updateInstrData).eq("id", srcId);
        }

        // 4. Delete temp instructions
        await supabase.from("instructions").delete().in("id", tempInstrIds);
      }

      // 5. Remap instruction IDs in the mission back to original IDs
      const remapBack = (instructions: Array<[string, string?]> = []): Array<[string, string?]> =>
        instructions.map(([id, title]) => {
          const baseId = id.includes("#") ? id.split("#")[0] : id;
          const suffix = id.includes("#") ? "#" + id.split("#")[1] : "";
          const srcId = tempToSourceMap.has(baseId) ? tempToSourceMap.get(baseId)! + suffix : id;
          return title !== undefined ? [srcId, title] : [srcId];
        });

      const updateMissionData: any = { updated_at: new Date().toISOString() };
      if (tempRow.data_en) {
        updateMissionData.data_en = {
          ...tempRow.data_en,
          id: sourceMissionId,
          instructions: remapBack(tempRow.data_en.instructions),
        };
      }
      if (tempRow.data_he) {
        updateMissionData.data_he = {
          ...tempRow.data_he,
          id: sourceMissionId,
          instructions: remapBack(tempRow.data_he.instructions),
        };
      }

      // 6. Update the source mission with the temp mission's data
      await supabase.from("missions").update(updateMissionData).eq("id", sourceMissionId);

      // 7. Delete the temp mission
      await supabase.from("missions").delete().eq("id", tempMissionId);

      return {
        success: true,
        message: "Changes published to the original mission successfully!",
        sourceMissionId,
      };
    } catch (error) {
      console.error("Error in publishTestMode:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (actionType === "discardTestMode") {
    const accessToken = formData.get("accessToken") as string | null;
    const tempMissionId = formData.get("tempMissionId") as string | null;

    if (!accessToken) return { success: false, error: "Unauthorized: Authentication required" };
    if (!tempMissionId) return { success: false, error: "Temp mission ID is required" };

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // Fetch the temp mission
      const { data: tempRow, error: fetchErr } = await supabase
        .from("missions")
        .select("data_en, data_he, source_mission_id")
        .eq("id", tempMissionId)
        .eq("is_temp", true)
        .single();

      if (fetchErr || !tempRow) {
        return { success: false, error: fetchErr?.message || "Temp mission not found" };
      }

      const sourceMissionId = tempRow.source_mission_id as string;

      // Collect all temp instruction IDs
      const specialPrefixes = ["if-", "end-if-", "else-", "comment-"];
      const isTempId = (id: string) => id.startsWith("T") && /^T\d+$/.test(id);
      const isSpecial = (id: string) =>
        isTempId(id) || specialPrefixes.some((p) => id.startsWith(p)) || id === "0";

      const collectIds = (instructions: Array<[string, string?]> = []) =>
        instructions
          .map(([id]) => (id.includes("#") ? id.split("#")[0] : id))
          .filter((id) => !isSpecial(id));

      const tempInstrIds = Array.from(
        new Set([...collectIds(tempRow.data_en?.instructions), ...collectIds(tempRow.data_he?.instructions)]),
      );

      // Delete temp instructions
      if (tempInstrIds.length > 0) {
        await supabase.from("instructions").delete().in("id", tempInstrIds).eq("is_temp", true);
      }

      // Delete the temp mission
      await supabase.from("missions").delete().eq("id", tempMissionId);

      return {
        success: true,
        message: "Test session discarded. No changes were made to the original.",
        sourceMissionId,
      };
    } catch (error) {
      console.error("Error in discardTestMode:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // ─── End Test Mode ────────────────────────────────────────────────────────

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

  if (actionType === "duplicateInstruction") {
    const accessToken = formData.get("accessToken") as string | null;
    const sourceInstructionId = formData.get("sourceInstructionId") as string | null;
    const targetLanguage = formData.get("language") as string;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }
    if (!sourceInstructionId) {
      return { success: false, error: "Source instruction ID is required" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // Fetch source row
      const { data: sourceRow, error: fetchError } = await supabase
        .from("instructions")
        .select("data_en, data_he")
        .eq("id", sourceInstructionId)
        .single();

      if (fetchError || !sourceRow) {
        return { success: false, error: fetchError?.message || "Source instruction not found" };
      }

      // Determine next numeric ID across all instructions
      const { data: existingInstructions, error: listError } = await supabase
        .from("instructions")
        .select("id");

      if (listError) {
        return { success: false, error: listError.message };
      }

      const numericIds = (existingInstructions || [])
        .map((i: any) => parseInt(i.id, 10))
        .filter((n: number) => !isNaN(n));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const newId = String(maxId + 1);

      // Deep-copy with updated id and " Copy" appended to the title
      const newDataEn = sourceRow.data_en
        ? { ...sourceRow.data_en, id: newId, title: `${(sourceRow.data_en.title || "").trim()} Copy`.trim() }
        : { id: newId, title: "Copy", explanation: [] };
      const newDataHe = sourceRow.data_he
        ? { ...sourceRow.data_he, id: newId, title: `${(sourceRow.data_he.title || "").trim()} Copy`.trim() }
        : null;

      const insertData: any = {
        id: newId,
        data_en: newDataEn,
        data_he: newDataHe,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from("instructions").insert(insertData);

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return {
        success: true,
        message: `Instruction duplicated as ${newId}!`,
        newInstructionId: newId,
      };
    } catch (error) {
      console.error("Error in duplicateInstruction:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
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

  if (actionType === "updateKeywords") {
    const imagePath = formData.get("imagePath") as string;
    const keywordsRaw = formData.get("keywords") as string;
    const software = formData.get("software") as string;
    const module = formData.get("module") as string;
    const screen = formData.get("screen") as string;
    const item = formData.get("item") as string;

    if (!imagePath) return { success: false, error: "Image path is required" };

    try {
      const keywords = JSON.parse(keywordsRaw) as string[];
      const { upsertImageKeywords } = await import("~/services/image-keywords.server");
      const result = await upsertImageKeywords(imagePath, {
        keywords,
        software: software || null,
        module: module || null,
        screen: screen || null,
        item: item || null,
      });
      return result.success
        ? { success: true, message: "Keywords and categories saved!" }
        : { success: false, error: result.error ?? "Failed to save keywords" };
    } catch {
      return { success: false, error: "Invalid keywords data" };
    }
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