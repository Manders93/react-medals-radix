import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/AWD-homework/react-medals-radix/',
  plugins: [react()],
})
