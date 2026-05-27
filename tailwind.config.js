/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',         // ⚠️ สำคัญมาก! โค้ดใช้ class-based dark mode
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}