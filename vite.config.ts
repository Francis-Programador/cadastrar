import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/membros": {
        target: "https://script.google.com/macros/s/AKfycbwaFv76W7qTpk472VWFaWDnzdALM3KkT3bCrBS5z4r9nshga2BalxYYzL_0WIxaospn2A/exec",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/membros/, ""),
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "shared-footer-template",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "footer.html",
          source: readFileSync(path.resolve(__dirname, "footer.html"), "utf8"),
        });
      },
    },
  ].filter(Boolean),
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        "navegacao/index": path.resolve(__dirname, "navegacao/index.html"),
        "navegacao/dashboard": path.resolve(__dirname, "navegacao/dashboard.html"),
        "navegacao/cadastrar": path.resolve(__dirname, "navegacao/cadastrar.html"),
        "navegacao/relatorios": path.resolve(__dirname, "navegacao/relatorios.html"),
        "navegacao/recursos": path.resolve(__dirname, "navegacao/recursos.html"),
        "recursos/wallets": path.resolve(__dirname, "recursos/wallets.html"),
        "recursos/corretoras": path.resolve(__dirname, "recursos/corretoras.html"),
        "recursos/materiais": path.resolve(__dirname, "recursos/materiais.html"),
        "recursos/formacao": path.resolve(__dirname, "recursos/formacao.html"),
        "membros/index": path.resolve(__dirname, "membros/index.html"),
        "membros/dashboard": path.resolve(__dirname, "membros/dashboard.html"),
        "membros/sala-ao-vivo": path.resolve(__dirname, "membros/sala-ao-vivo.html"),
        "membros/suporte-emocional": path.resolve(__dirname, "membros/suporte-emocional.html"),
        "membros/biblioteca": path.resolve(__dirname, "membros/biblioteca.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
