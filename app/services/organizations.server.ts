import { getSupabase } from "~/lib/supabase";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export async function getOrganizations(): Promise<Organization[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching organizations:", error);
    return [];
  }

  return (data || []) as Organization[];
}

export async function createOrganization(name: string, slug: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase.from("organizations").insert({ name, slug });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deleteOrganization(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase.from("organizations").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export interface PendingUser {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  organization_id: string | null;
  created_at: string;
}

export async function getPendingUsers(): Promise<PendingUser[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .is("organization_id", null)
    .neq("role", "admin")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending users:", error);
    return [];
  }

  return (data || []) as PendingUser[];
}

export async function getAllUsers(): Promise<PendingUser[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return (data || []) as PendingUser[];
}

export async function assignUserOrganization(
  userId: string,
  organizationId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ organization_id: organizationId })
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getMissionOrganizations(missionId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mission_organizations")
    .select("organization_id")
    .eq("mission_id", missionId);

  if (error) {
    console.error("Error fetching mission organizations:", error);
    return [];
  }

  return (data || []).map((r: any) => r.organization_id);
}

export async function setMissionOrganizations(
  missionId: string,
  organizationIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  // Delete existing records
  const { error: deleteError } = await supabase
    .from("mission_organizations")
    .delete()
    .eq("mission_id", missionId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // Insert new records if any
  if (organizationIds.length > 0) {
    const records = organizationIds.map((orgId) => ({
      mission_id: missionId,
      organization_id: orgId,
    }));

    const { error: insertError } = await supabase.from("mission_organizations").insert(records);
    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  return { success: true };
}

export async function setMissionExample(
  missionId: string,
  isExample: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("missions")
    .update({ is_example: isExample })
    .eq("id", missionId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
