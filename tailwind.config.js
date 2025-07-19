// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-color': '#121212',
        'primary-text-color': '#ffffff',
        'secondary-text-color': '#b3b3b3',
        'card-bg-color': '#181818',
        'card-hover-bg-color': '#282828',
        'accent-color': '#1DB954',
      }
    },
  },
  plugins: [],
}
