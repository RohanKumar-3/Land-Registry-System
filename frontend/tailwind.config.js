/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {

      /* ---------------- Fonts ---------------- */
      fontFamily: {
        body: ["Inter", "sans-serif"],
        display: ["Poppins", "sans-serif"],
      },

      /* ---------------- Colors ---------------- */
      colors: {

        earth: {
          50: "#faf7f2",
          100: "#f3ebe0",
          200: "#e6d2b8",
          300: "#d6b98f",
          400: "#c6a065",
          500: "#9e7a4f",  // main earth color
          600: "#7c5f3d",
          700: "#5a452c",
          800: "#382a1a",
          900: "#1a120c",
        },

        forest: {
          50: "#eef6f0",
          100: "#d5e8da",
          200: "#abd2b6",
          300: "#7fb891",
          400: "#5ea874",
          500: "#2a5a3c", // main forest color
          600: "#21482f",
          700: "#183622",
          800: "#0f2416",
          900: "#08150d",
        },

      },

      /* ---------------- Shadows ---------------- */
      boxShadow: {

        card: "0 8px 24px rgba(0,0,0,0.25)",

        earth:
          "0 6px 18px rgba(158,122,79,0.35)",

        glow:
          "0 0 20px rgba(158,122,79,0.55)",

      },

      /* ---------------- Animations ---------------- */
      keyframes: {
        fadeSlideUp: {
          "0%": {
            opacity: "0",
            transform: "translateY(16px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },

      animation: {
        fadeSlideUp: "fadeSlideUp 0.35s ease forwards",
      },

    },
  },

  plugins: [],
};