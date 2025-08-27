/** @type {import('lint-staged').Config} */
export default {
  // TypeScript files
  "*.{ts,tsx}": (files) => {
    const filtered = files.filter((f) => !/tests\/templates\/|\.template\.tsx?$/.test(f));
    return filtered.length
      ? [
          // Format with Prettier
          `prettier --write ${filtered.join(" ")}`,
        ]
      : [];
  },

  // JavaScript files
  "*.{js,jsx}": [
    // Format with Prettier
    "prettier --write",
  ],

  // JSON files
  "*.json": [
    // Format with Prettier
    "prettier --write",
  ],

  // CSS and SCSS files
  "*.{css,scss,sass}": [
    // Format with Prettier
    "prettier --write",
  ],

  // Markdown files
  "*.md": [
    // Format with Prettier (respecting prose wrap settings)
    "prettier --write",
  ],

  // YAML files
  "*.{yml,yaml}": [
    // Format with Prettier
    "prettier --write",
  ],

  // HTML files
  "*.html": [
    // Format with Prettier
    "prettier --write",
  ],

  // Package.json files (special handling)
  "package.json": [
    // Sort package.json keys
    "npx sort-package-json",
    // Format with Prettier
    "prettier --write",
  ],

  // Configuration files
  "*.config.{js,ts,mjs,cjs}": [
    // Format with Prettier
    "prettier --write",
  ],

  // Environment files - skip formatting since they have simple key=value syntax
  // '.env*': [],

  // Git ignore files - skip formatting since they have simple glob patterns
  // '.{gitignore,prettierignore,eslintignore}': [],
};
