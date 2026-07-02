import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the static build works on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) without hardcoding the repo name.
export default defineConfig({
  plugins: [react()],
  base: './',
});
