/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#12141c',
          card: '#1a1d29',
          border: '#2a2e3e',
        },
        accent: {
          DEFAULT: '#7c5cff',
          green: '#3ddc97',
          amber: '#ffb84d',
          red: '#ff6b6b',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
