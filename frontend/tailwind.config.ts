import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080B11",
        surface: "#0D121C",
        "surface-light": "#141C2B",
        border: "#1E2738",
        accent: {
          DEFAULT: "#26A17B", // USDT Tether Green
          light: "#00D492",   // Mint Emerald Highlight
          dark: "#1A7357",    // Deep Emerald
        },
        tether: {
          DEFAULT: "#26A17B",
          glow: "#00D492",
          dark: "#145942",
        },
        success: "#00D492",
        danger: "#F43F5E",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-accent": "linear-gradient(135deg, #26A17B 0%, #00D492 100%)",
        "gradient-success": "linear-gradient(135deg, #26A17B 0%, #10B981 100%)",
        "gradient-danger": "linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(38, 161, 123, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(38, 161, 123, 0.6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
