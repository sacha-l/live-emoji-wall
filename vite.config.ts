import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    base: "./",
    plugins: [react()],
    optimizeDeps: {
        entries: ["index.html"],
    },
    server: {
        host: true,
        watch: {
            ignored: ["**/reference-repos/**"],
        },
    },
});
