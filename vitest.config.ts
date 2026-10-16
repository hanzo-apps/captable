import { defineConfig } from "vitest/config";

// Next compiles JSX with React's automatic runtime; the tests compile it the
// same way, so a component renders under vitest exactly as the app builds it.
export default defineConfig({
  esbuild: { jsx: "automatic" },
});
