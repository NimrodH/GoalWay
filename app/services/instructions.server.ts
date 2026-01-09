import { getSupabase } from "~/lib/supabase";

export interface InstructionContent {
  type: "text" | "image" | "video";
  content: string;
}

export interface Instruction {
  id: string;
  title: string;
  explanation: InstructionContent[];
  type?: "default" | "link";
  missionId?: string;
}

export async function getAllInstructions(): Promise<Instruction[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("instructions")
    .select("data_en")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching instructions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_en !== null)
    .map((row: any) => row.data_en as Instruction);
}

export async function getAllInstructionsHe(): Promise<Instruction[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("instructions")
    .select("data_he")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching Hebrew instructions:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.data_he !== null)
    .map((row: any) => row.data_he as Instruction);
}

export async function getInstructionById(instructionId: string): Promise<Instruction | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("instructions")
    .select("data_en")
    .eq("id", instructionId)
    .single();

  if (error || !data?.data_en) {
    console.error("Error fetching instruction:", error);
    return null;
  }

  return data.data_en as Instruction;
}

export async function getInstructionByIdHe(instructionId: string): Promise<Instruction | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("instructions")
    .select("data_he")
    .eq("id", instructionId)
    .single();

  if (error || !data?.data_he) {
    console.error("Error fetching Hebrew instruction:", error);
    return null;
  }

  return data.data_he as Instruction;
}

export async function getInstructionsByIds(instructionIds: string[]): Promise<Instruction[]> {
  if (instructionIds.length === 0) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("instructions")
    .select("data_en")
    .in("id", instructionIds);

  if (error) {
    console.error("Error fetching instructions by IDs:", error);
    return [];
  }

  // Maintain the order from instructionIds
  const instructionsMap = new Map(
    (data || [])
      .filter((row: any) => row.data_en !== null)
      .map((row: any) => [row.data_en.id, row.data_en as Instruction])
  );

  return instructionIds
    .map((id) => instructionsMap.get(id))
    .filter((inst): inst is Instruction => inst !== undefined);
}

export async function getInstructionsByIdsHe(instructionIds: string[]): Promise<Instruction[]> {
  if (instructionIds.length === 0) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("instructions")
    .select("data_he")
    .in("id", instructionIds);

  if (error) {
    console.error("Error fetching Hebrew instructions by IDs:", error);
    return [];
  }

  // Maintain the order from instructionIds
  const instructionsMap = new Map(
    (data || [])
      .filter((row: any) => row.data_he !== null)
      .map((row: any) => [row.data_he.id, row.data_he as Instruction])
  );

  return instructionIds
    .map((id) => instructionsMap.get(id))
    .filter((inst): inst is Instruction => inst !== undefined);
}
