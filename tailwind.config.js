/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app toggles the theme itself (see src/theme), so dark mode follows a class, not the OS.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode page background. Cards use gray-900 (#111827).
        obsidian: '#0B0F19',
      },
    },
  },
  plugins: [],
};
