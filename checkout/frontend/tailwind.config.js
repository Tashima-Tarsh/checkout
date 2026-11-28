/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pearl: {
          50: '#FFF7F0',
          100: '#FFFCF5',
          200: '#FFF3E0',
          300: '#FFE8C4',
          400: '#FFD8A8',
          500: '#F4E5BD',
        },
        champagne: {
          50: '#FDF8F0',
          100: '#F7EBD8',
          200: '#F0D8B5',
          300: '#E8C59A',
          400: '#E1B27F',
          500: '#D8BC87',
        },
        emerald: {
          50: '#E7F8EE',
          100: '#D1F5DE',
          200: '#B7EBCD',
          300: '#99E0BC',
          400: '#76D4A7',
          500: '#065440',
        },
        opal: {
          50: '#F7F4FC',
          100: '#EDE7FC',
          200: '#E3D6F7',
          300: '#D9C3F1',
          400: '#D0B7EA',
          500: '#C7A8E3',
        },
      },
      fontFamily: {
        sans: ['"Manrope"', 'sans-serif'],
        inter: ['"Inter"', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}
