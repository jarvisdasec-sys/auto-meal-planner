/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#080a08', card: '#111411', border: '#292e29' },
        accent: { DEFAULT: '#8CFF00', green: '#8CFF00', amber: '#ffbf69', red: '#ff8080' },
      },
      fontFamily: {
        sans: ['Barlow', 'Arial', 'sans-serif'],
        display: ['Oswald', 'Arial Narrow', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      borderRadius: { xl: '0.85rem', '2xl': '1rem' },
    },
  },
  plugins: [],
};
