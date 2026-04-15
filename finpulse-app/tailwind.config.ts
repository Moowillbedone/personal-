import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#0a0a1a",
          card: "#12122a",
          border: "#1e1e3a",
          muted: "#6b7280",
        },
        accent: "#6366f1",
        up: "#22c55e",
        down: "#ef4444",
      },
    },
  },
  plugins: [],
};
export default config;
