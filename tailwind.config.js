/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        dark: '#080708',
        light: '#F4F4F5',
        'txt-dark': '#E6E8E6',
        'txt-light': '#18181B',
      },
    },
  },
  plugins: [],
};
