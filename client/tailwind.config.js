/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#06060e',
        surface: '#0d0d1c',
        'surface-2': '#131328',
        neon: '#00d4ff',
        'neon-purple': '#b44dff',
        dim: '#7777aa',
      },
      boxShadow: {
        neon: '0 0 20px rgba(0,212,255,0.35), 0 0 60px rgba(0,212,255,0.1)',
        'neon-sm': '0 0 12px rgba(0,212,255,0.2)',
        'neon-purple': '0 0 20px rgba(180,77,255,0.35)',
        card: '0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
};
