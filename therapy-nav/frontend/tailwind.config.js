/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sage: {
          50: "#f4f7f4",
          100: "#e6ede6",
          200: "#cddccc",
          300: "#a8c2a7",
          400: "#7da27c",
          500: "#5c835c",
          600: "#486848",
          700: "#3b543b",
          800: "#314431",
          900: "#293829",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
