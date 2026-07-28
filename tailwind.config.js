/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        serif: ['var(--font-playfair)', '"Playfair Display"', 'serif'],
        handwriting: ['var(--font-pacifico)', 'Pacifico', 'cursive'],
      },
      colors: {
        brand: {
          DEFAULT: '#0a0a0a',
          light: '#1a1a1a',
          dark: '#000000',
          accent: '#c9a227',
          muted: '#8a7a4a',
        },
        store: {
          // Token names kept for compatibility; values are black / gold / white
          navy: '#0a0a0a',
          'navy-light': '#1f1f1f',
          primary: '#c9a227',
          'primary-dark': '#a8861f',
          ink: '#0a0a0a',
          muted: '#6b6b6b',
          surface: '#f7f7f5',
        },
      },
    },
  },
  plugins: [],
}
