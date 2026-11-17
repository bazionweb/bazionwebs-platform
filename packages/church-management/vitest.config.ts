import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "react-router-dom": path.resolve(__dirname, "./src/shims/react-router-dom.tsx"),
      "@apollo/client/link/context": path.resolve(__dirname, "./src/shims/apollo.tsx"),
      "@apollo/client": path.resolve(__dirname, "./src/shims/apollo.tsx"),
      "@clerk/clerk-react": path.resolve(__dirname, "./src/shims/clerk.tsx"),
      "@clerk/themes": path.resolve(__dirname, "./src/shims/clerk-themes.ts"),
      "lucide-react": path.resolve(__dirname, "./src/shims/lucide-react.tsx"),
      "recharts": path.resolve(__dirname, "./src/shims/recharts.tsx"),
      "jspdf": path.resolve(__dirname, "./src/shims/jspdf.ts"),
      "jspdf-autotable": path.resolve(__dirname, "./src/shims/jspdf-autotable.ts"),
      "react-image-crop/dist/ReactCrop.css": path.resolve(__dirname, "./src/shims/empty.css"),
      "react-image-crop": path.resolve(__dirname, "./src/shims/react-image-crop.tsx"),
      "idb": path.resolve(__dirname, "./src/shims/idb.ts"),
      "google-auth-library": path.resolve(__dirname, "./src/shims/google-auth-library.ts"),
      "@google/genai": path.resolve(__dirname, "./src/shims/google-genai.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
