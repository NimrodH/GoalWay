import { getSupabase } from "~/lib/supabase";

export interface Mission {
  id: string;
  title: string;
  description: string;
  instructions: Array<[string, string?]>; // [instructionId, customTitle?]
  status?: "Hide" | "For all" | "Only Adama" | "Only Bazn";
  isExample?: boolean;
  /** Set to true for temporary test-mode copies — admin only, never shown to users */
  isTemp?: boolean;
  /** For temp missions: the ID of the original mission this was cloned from */
  sourceMissionId?: string | null;
}

// Legacy format from database (before migration)
interface LegacyMission {
  id: string;
  title: string;
  description: string;
  instructionIds?: string[];
  instructionTitles?: Record<string, string>;
}

// Migrate legacy mission format to new format
function migrateLegacyMission(legacy: LegacyMission | Mission): Mission {
  // Check if already in new format
  if ('instructions' in legacy) {
    return legacy as Mission;
  }
  
  // Convert old format to new format
  const instructions: Array<[string, string?]> = (legacy.instructionIds || []).map(id => {
    const customTitle = legacy.instructionTitles?.[id];
    return customTitle ? [id, customTitle] : [id];
  });
  
  return {
    id: legacy.id,
    title: legacy.title,
    description: legacy.description,
    instructions,
  };
}

/**
 * Fetch all English missions.
 * @param includeTemp - When true, includes temporary test-mode missions (admin only).
 */
export async function getAllMissions(includeTemp = false): Promise<Mission[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("missions")
    .select("id, data_en, is_example, is_temp, source_mission_id")
    .order("created_at", { ascending: true });

  if (!includeTemp) {
    query = query.eq("is_temp", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_en !== null)
    .map((row: any) => ({
      ...migrateLegacyMission(row.data_en),
      isExample: row.is_example ?? false,
      isTemp: row.is_temp ?? false,
      sourceMissionId: row.source_mission_id ?? null,
    }));
}

/**
 * Fetch all Hebrew missions.
 * @param includeTemp - When true, includes temporary test-mode missions (admin only).
 */
export async function getAllMissionsHe(includeTemp = false): Promise<Mission[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("missions")
    .select("id, data_he, is_example, is_temp, source_mission_id")
    .order("created_at", { ascending: true });

  if (!includeTemp) {
    query = query.eq("is_temp", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching Hebrew missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_he !== null)
    .map((row: any) => ({
      ...migrateLegacyMission(row.data_he),
      isExample: row.is_example ?? false,
      isTemp: row.is_temp ?? false,
      sourceMissionId: row.source_mission_id ?? null,
    }));
}

export async function getMissionById(missionId: string): Promise<Mission | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_en")
    .eq("id", missionId)
    .eq("is_temp", false)
    .single();

  if (error || !data?.data_en) {
    console.error("Error fetching mission:", error);
    return null;
  }

  return migrateLegacyMission(data.data_en);
}

export async function getMissionByIdHe(missionId: string): Promise<Mission | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_he")
    .eq("id", missionId)
    .eq("is_temp", false)
    .single();

  if (error || !data?.data_he) {
    console.error("Error fetching Hebrew mission:", error);
    return null;
  }

  return migrateLegacyMission(data.data_he);
}

/**
 * Fetch Hebrew missions that are flagged as examples (publicly visible to all users).
 */
export async function getExampleMissionsHe(): Promise<Mission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_he, is_example")
    .eq("is_example", true)
    .eq("is_temp", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching Hebrew example missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_he !== null)
    .map((row: any) => ({
      ...migrateLegacyMission(row.data_he),
      isExample: true,
    }));
}

/**
 * Fetch Hebrew missions visible to a specific organization.
 */
export async function getMissionsForOrganizationHe(organizationId: string): Promise<Mission[]> {
  const supabase = getSupabase();

  const { data: access, error: accessError } = await supabase
    .from("mission_organizations")
    .select("mission_id")
    .eq("organization_id", organizationId);

  if (accessError) {
    console.error("Error fetching org mission access (he):", accessError);
    return [];
  }

  const allowedIds = (access || []).map((r: any) => r.mission_id);
  if (allowedIds.length === 0) return [];

  const { data, error } = await supabase
    .from("missions")
    .select("data_he, is_example")
    .in("id", allowedIds)
    .eq("is_temp", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching org Hebrew missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_he !== null)
    .map((row: any) => ({
      ...migrateLegacyMission(row.data_he),
      isExample: row.is_example ?? false,
    }));
}

/**
 * Fetch missions that are flagged as examples (publicly visible to all users).
 */
export async function getExampleMissions(): Promise<Mission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_en, is_example")
    .eq("is_example", true)
    .eq("is_temp", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching example missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_en !== null)
    .map((row: any) => ({
      ...migrateLegacyMission(row.data_en),
      isExample: true,
    }));
}

/**
 * Fetch missions visible to a specific organization (excludes hidden missions).
 */
export async function getMissionsForOrganization(organizationId: string): Promise<Mission[]> {
  const supabase = getSupabase();

  // Get mission IDs allowed for this org
  const { data: access, error: accessError } = await supabase
    .from("mission_organizations")
    .select("mission_id")
    .eq("organization_id", organizationId);

  if (accessError) {
    console.error("Error fetching org mission access:", accessError);
    return [];
  }

  const allowedIds = (access || []).map((r: any) => r.mission_id);
  if (allowedIds.length === 0) return [];

  const { data, error } = await supabase
    .from("missions")
    .select("data_en, is_example")
    .in("id", allowedIds)
    .eq("is_temp", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching org missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_en !== null)
    .map((row: any) => ({
      ...migrateLegacyMission(row.data_en),
      isExample: row.is_example ?? false,
    }));
}

/**
 * Check if a specific mission is accessible to a given organization or is an example.
 */
export async function checkMissionAccess(
  missionId: string,
  organizationId: string | null
): Promise<boolean> {
  const supabase = getSupabase();

  // First, check if mission is an example (publicly accessible) and not temp
  const { data: missionRow } = await supabase
    .from("missions")
    .select("is_example, is_temp")
    .eq("id", missionId)
    .single();

  if (missionRow?.is_temp) return false; // temp missions never accessible to users
  if (missionRow?.is_example) return true;

  // Otherwise check org access
  if (!organizationId) return false;

  const { data } = await supabase
    .from("mission_organizations")
    .select("mission_id")
    .eq("mission_id", missionId)
    .eq("organization_id", organizationId)
    .single();

  return !!data;
}

/**
 * Fetch all mission IDs.
 * @param includeTemp - When true, includes temporary test-mode mission IDs (admin only).
 */
export async function getAllMissionIds(includeTemp = false): Promise<string[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("missions")
    .select("id")
    .order("created_at", { ascending: true });

  if (!includeTemp) {
    query = query.eq("is_temp", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching mission IDs:", error);
    return [];
  }

  return (data || []).map((row: any) => row.id as string);
}
