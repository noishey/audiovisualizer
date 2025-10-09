import { defineConfig } from 'vite';

export default defineConfig({
  // Serve index.html from the src directory
  root: 'src',
  // Use the existing static folder as the public directory
  publicDir: '../static',
});