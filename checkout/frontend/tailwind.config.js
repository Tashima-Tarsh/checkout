/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        porcelain: '#F7F5EF',
        graphite: '#242722',
        deepEmerald: '#245C49',
        sage: '#B9CFBC',
        champagne: '#C4A575',
      },
      fontFamily: {
        brand: ['"Satoshi"', '"PP Neue Montreal"', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['"Geist"', '"Satoshi"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
