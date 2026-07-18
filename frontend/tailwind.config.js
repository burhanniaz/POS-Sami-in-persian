/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#22221F",
        muted: "#9A9A94",
        subtle: "#5B5B55",
        paper: "#EFEFEF",
        card: "#FFFFFF",
        line: "#EDEDE8",
        accent: {
          DEFAULT: "#0F6E56",
          light: "#E1F5EE",
          dark: "#085041",
        },
        warn: {
          DEFAULT: "#854F0B",
          light: "#FAEEDA",
        },
        danger: {
          DEFAULT: "#993C1D",
          light: "#FAECE7",
        },
      },
      fontFamily: {
        fa: ["Vazirmatn", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
