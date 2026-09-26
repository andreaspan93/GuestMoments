import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
  },
  ssr: {
    noExternal: ["next-intl"],
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      "next/server": path.resolve(root, "./node_modules/next/server.js"),
    },
  },
});
