const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "index.html"),
    path.join(__dirname, "src/**/*.{ts,tsx,html}"),
    path.join(__dirname, "src/excalidraw/renderer/**/*.{ts,tsx}"),
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
