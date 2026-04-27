import { getSupabase } from "~/lib/supabase";

export type BadgeSide = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface Annotation {
  id: string;
  x: number;          // % from left (0–100)
  y: number;          // % from top  (0–100)
  width: number;      // % of image width
  height: number;     // % of image height
  label: number;      // sequential number shown on the badge
  color?: string;     // hex color string, e.g. "#e5484d"
  badgeSide?: BadgeSide; // which corner of the rectangle the badge sits on (default top-left)
  text?: string;      // optional markdown description shown below the image
}

export interface InstructionContent {
  type: "text" | "image" | "video";
  content: string;
  annotations?: Annotation[];
}

export interface Instruction {
  id: string;
  title: string;
  description?: string;
  status?: "only title" | "partial explanation" | "full explanation";
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

export async function getAllInstructionIds(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("instructions")
    .select("id")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching instruction IDs:", error);
    return [];
  }

  return (data || []).map((row: any) => row.id as string);
}
