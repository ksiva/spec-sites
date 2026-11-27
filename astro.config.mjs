import { defineConfig } from "astro/config";

// Published as a GitHub Pages project site: https://ksiva.github.io/spec-sites/
export default defineConfig({
  site: "https://ksiva.github.io",
  base: "/spec-sites",
  trailingSlash: "always",
  devToolbar: { enabled: false },
});
