import { data } from "react-router";
import type { Route } from "./+types/api.missions.$missionId";
import { getMissionById } from "~/services/missions.server";
import { getInstructionsByIds } from "~/services/instructions.server";

export async function loader({ params }: Route.LoaderArgs) {
  const mission = await getMissionById(params.missionId);

  if (!mission) {
    return data({ error: "Mission not found" }, { status: 404 });
  }

  // Strip duplicate-occurrence suffixes (#2, #3, …) and de-duplicate before querying the DB
  const rawIds = mission.instructions.map(([id]) => id);
  const uniqueBaseIds = [...new Set(rawIds.map((id) => (id.includes("#") ? id.split("#")[0] : id)))];
  const instructions = await getInstructionsByIds(uniqueBaseIds);

  return data({ mission, instructions });
}
