/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" }
        },
        "count-up": {
          "0%": { opacity: "0.6", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 420ms ease-out both",
        "soft-pulse": "soft-pulse 2.2s ease-in-out infinite",
        "count-up": "count-up 400ms ease-out both"
      },
      screens: {
        "laptop": "1280px",
        "desktop": "1440px"
      },
      colors: {
        surface: {
          DEFAULT: "#020617",
          muted: "#020617",
          raised: "#020617"
        },
        brand: {
          primary: "#2563EB",
          secondary: "#0F172A",
          accent: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444"
        }
      }
    }
  },
  plugins: []
};

