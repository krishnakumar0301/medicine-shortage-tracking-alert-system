/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        medical: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe3fe",
          300: "#93d2fd",
          400: "#60b8fa",
          500: "#3b98f6",
          600: "#2579eb",
          700: "#1d63d8",
          800: "#1e51af",
          900: "#1e478a",
          950: "#172c54",
        },
        tealish: {
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(16, 42, 67, 0.08), 0 6px 20px -8px rgba(16, 42, 67, 0.12)",
        soft: "0 10px 35px -12px rgba(23, 44, 84, 0.25)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
