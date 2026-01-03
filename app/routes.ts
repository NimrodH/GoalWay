import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("missions", "routes/missions.tsx"),
  route("missions/:missionId", "routes/missions.$missionId.tsx"),
] satisfies RouteConfig;
