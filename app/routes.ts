import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("unauthorized", "routes/unauthorized.tsx"),
  route("help", "routes/help.tsx"),
  route("missions/:missionId", "routes/missions.$missionId.tsx"),
  route("admin", "routes/admin.tsx"),
  route("instructions-with-images", "routes/instructions-with-images.tsx"),
  
  // API routes
  route("api/missions/:missionId", "routes/api.missions.$missionId.tsx"),
  route("api/he/missions/:missionId", "routes/api.he.missions.$missionId.tsx"),
  
  // Hebrew routes
  route("he", "routes/he.home.tsx"),
  route("he/missions/:missionId", "routes/he.missions.$missionId.tsx"),
] satisfies RouteConfig;
