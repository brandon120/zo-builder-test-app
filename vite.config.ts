import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT) || 4173;
const useStrictPort = Boolean(process.env.PORT);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port,
    strictPort: useStrictPort,
  },
  preview: {
    host: true,
    port,
    strictPort: useStrictPort,
  },
});
