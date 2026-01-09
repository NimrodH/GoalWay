import { missionsHe } from "~/data/missions-he";

interface SuggestedRoute {
  title: string;
  uri: string;
}

interface RouteDescription {
  suggestedRoutes: SuggestedRoute[];
  itemTitle: string;
}

export function getRouteDescription(): RouteDescription {
  return {
    suggestedRoutes: missionsHe.map((mission) => ({
      title: mission.title,
      uri: `/he/missions/${mission.id}`,
    })),
    itemTitle: "Mission",
  };
}
