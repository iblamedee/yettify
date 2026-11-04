/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: "#1ed760",
          "green-hover": "#1fdf64",
          "green-press": "#169b45",
          base: "#121212",
          card: "#181818",
          "card-hover": "#282828",
          surface: "#1f1f1f",
          subtext: "#b3b3b3",
          muted: "#6a6a6a",
          dark: "#000000",
          border: "#282828",
          error: "#f3727f",
          warning: "#ffa42b",
          info: "#539df5",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        pill: "9999px",
      },
      boxShadow: {
        "spotify-card": "0 8px 24px rgba(0,0,0,0.5)",
        "spotify-elevated": "0 16px 32px rgba(0,0,0,0.7)",
        "spotify-play": "0 8px 16px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
