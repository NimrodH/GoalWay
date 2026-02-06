import { data } from "react-router";
import type { Route } from "./+types/api.he.missions.$missionId";
import { getMissionByIdHe } from "~/services/missions.server";
import { getInstructionsByIdsHe } from "~/services/instructions.server";

export async function loader({ params }: Route.LoaderArgs) {
  const mission = await getMissionByIdHe(params.missionId);

  if (!mission) {
    return data({ error: "Mission not found" }, { status: 404 });
  }

  const instructionIds = mission.instructions.map(([id]) => id);
  const instructions = await getInstructionsByIdsHe(instructionIds);

  return data({ mission, instructions });
}
