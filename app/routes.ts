import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("missions/:missionId", "routes/missions.$missionId.tsx"),
  route("admin", "routes/admin.tsx"),
  
  // Hebrew routes
  route("he", "routes/he.home.tsx"),
  route("he/missions/:missionId", "routes/he.missions.$missionId.tsx"),
] satisfies RouteConfig;
