import type { Config } from "tailwindcss";
const colors = require("tailwindcss/colors");

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      'sm': '768px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        background: "#f6f5f5",
        dark: "#1a202c",
        light: "#f7fafc",
        gray: "#8a8d91",
        primary: "#b9cddc",
        secondary: "#a8c4d8", // Lighter blue for buttons
        muted: "#e2e8f0", // Soft gray for backgrounds
        border: "#d1d5db", // Subtle gray for borders
      }
    },
  },
  plugins: [],
};
export default config;
