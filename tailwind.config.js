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
          DEFAULT: '#0a1931',
          light: '#122547',
          dark: '#061022',
          accent: '#6ab0ff',
          muted: '#5e76a6',
        },
        store: {
          navy: '#0a1931',
          'navy-light': '#122547',
          primary: '#6ab0ff',
          'primary-dark': '#5298eb',
          ink: '#0a1931',
          muted: '#5e76a6',
          surface: '#f3f4f6',
        },
      },
    },
  },
  plugins: [],
}

