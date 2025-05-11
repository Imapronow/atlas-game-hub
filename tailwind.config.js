// tailwind.config.js
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  mode: "jit",
  purge: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "neon-cyan": "#0ff",
        "neon-magenta": "#f0f",
        "neon-purple": "#8e44ad",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%":       { transform: "translate(1px, -1px)" },
        },
      },
      animation: {
        wiggle: "wiggle 0.1s infinite",
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        /* CRT scanline + wobble overlay */
        ".crt-overlay": {
          pointerEvents: "none",
          position: "absolute",
          inset: "0",
          backgroundImage:
            "repeating-linear-gradient(rgba(0,0,0,0.05) 0 1px, transparent 1px 2px)",
          mixBlendMode: "overlay",
          animation: "wiggle 0.1s infinite",
        },
        /* Neon glow filter */
        ".glow": {
          filter:
            "drop-shadow(0 0 8px rgba(0,255,255,0.6)) drop-shadow(0 0 8px rgba(255,0,255,0.6))",
        },
        /* Electric retro text */
        ".neon-text": {
          textShadow:
            "0 0 4px #fff, 0 0 8px var(--tw-colors-neon-cyan), 0 0 12px var(--tw-colors-neon-cyan)",
        },
      });
    },
  ],
};
