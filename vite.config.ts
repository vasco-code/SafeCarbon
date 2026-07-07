import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig({
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5183,
  },
});
