/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0d11',
          card: '#12171e',
          elevated: '#161c24',
          soft: '#1b222c',
          border: '#222a35',
        },
        safety: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#b45309',
        },
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },

  plugins: [],
};
