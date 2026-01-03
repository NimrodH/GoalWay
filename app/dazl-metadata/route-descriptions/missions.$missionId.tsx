import { missions } from "~/data/missions";

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
    suggestedRoutes: missions.map((mission) => ({
      title: mission.title,
      uri: `/missions/${mission.id}`,
    })),
    itemTitle: "Mission",
  };
}
