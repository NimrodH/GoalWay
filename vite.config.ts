import { reactRouter } from "@react-router/dev/vite";
import netlifyReactRouter from "@netlify/vite-plugin-react-router";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), netlifyReactRouter(), tsconfigPaths()],
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
});
