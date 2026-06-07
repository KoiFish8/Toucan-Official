/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Light / off-white surfaces
        bg: '#fafaf7',
        surface: '#ffffff',
        surface2: '#f4f4f0',
        border: '#ececE8',
        border2: '#e0e0da',
        // Text
        fg: '#1c1d21',
        fg2: '#3a3b41',
        fg3: '#6b6f76',
        fg4: '#9aa0a6',
        // Toucan brand palette (from the logo) — yellow kept, others tuned for light bg
        beak: '#f5c451',
        beakdeep: '#e9a93b',
        face: '#4f6db8',
        leaf: '#4e9e5e',
        branch: '#9c7a4d',
      },
      maxWidth: { home: '1140px' },
    },
  },
};
