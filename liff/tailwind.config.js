/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5f7',
          100: '#ffe4ea',
          200: '#fdcad6',
          300: '#fba5b9',
          400: '#f77293',
          500: '#ec4571',
          600: '#d12a59',
          700: '#af1f49',
          800: '#911c41',
          900: '#7a1c3c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'IBM Plex Sans Thai',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
