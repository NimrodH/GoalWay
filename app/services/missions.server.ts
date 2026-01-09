import { getSupabase } from "~/lib/supabase";

export interface Mission {
  id: string;
  title: string;
  description: string;
  instructionIds: string[];
}

export async function getAllMissions(): Promise<Mission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_en")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_en !== null)
    .map((row: any) => row.data_en as Mission);
}

export async function getAllMissionsHe(): Promise<Mission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_he")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching Hebrew missions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_he !== null)
    .map((row: any) => row.data_he as Mission);
}

export async function getMissionById(missionId: string): Promise<Mission | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_en")
    .eq("id", missionId)
    .single();

  if (error || !data?.data_en) {
    console.error("Error fetching mission:", error);
    return null;
  }

  return data.data_en as Mission;
}

export async function getMissionByIdHe(missionId: string): Promise<Mission | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("data_he")
    .eq("id", missionId)
    .single();

  if (error || !data?.data_he) {
    console.error("Error fetching Hebrew mission:", error);
    return null;
  }

  return data.data_he as Mission;
}

export async function getAllMissionIds(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("missions")
    .select("id")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching mission IDs:", error);
    return [];
  }

  return (data || []).map((row: any) => row.id as string);
}
