import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("advanced", "routes/advanced.tsx"),
  route("instructions", "routes/instructions.tsx"),
  route("instructions/:id", "routes/instructions.$id.tsx"),
] satisfies RouteConfig;
