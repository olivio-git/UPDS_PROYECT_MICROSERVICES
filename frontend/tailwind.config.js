import { defineConfig } from '@tailwindcss/vite';

export default defineConfig({
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ]  
});
