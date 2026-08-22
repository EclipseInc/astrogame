import { defineConfig } from "vite";

export default defineConfig({
  // Игра живёт в подпапке GitHub Pages: eclipseinc.github.io/astrogame/
  base: "/astrogame/",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900, // three.js крупнее порога по умолчанию
  },
});
