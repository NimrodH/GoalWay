import { data } from "react-router";
import type { Route } from "./+types/api.missions.$missionId";
import { getMissionById } from "~/services/missions.server";
import { getInstructionsByIds } from "~/services/instructions.server";

export async function loader({ params }: Route.LoaderArgs) {
  const mission = await getMissionById(params.missionId);

  if (!mission) {
    return data({ error: "Mission not found" }, { status: 404 });
  }

  const instructionIds = mission.instructions.map(([id]) => id);
  const instructions = await getInstructionsByIds(instructionIds);

  return data({ mission, instructions });
}
