/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Здесь можно будет добавлять свои цвета, шрифты и т.д.
      // Например:
      // colors: {
      //   'brand-blue': '#1a73e8',
      // }
    },
  },
  plugins: [],
}
