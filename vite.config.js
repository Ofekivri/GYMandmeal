import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        // React and Firebase (~90% of the code) in their own file, which only
        // changes when they're upgraded: after a deploy, phones download just
        // the app's own code and keep the rest.
        codeSplitting: { groups: [{ name: 'vendor', test: /[\\/]node_modules[\\/]/ }] },
      },
    },
  },
})
