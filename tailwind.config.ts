import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9f6',
          100: '#d5f0e7',
          200: '#abe1cf',
          300: '#7acdb3',
          400: '#4db393',
          500: '#2f9377',
          600: '#246f5b',
          700: '#1e5a4a',
          800: '#1a483c',
          900: '#163b32',
          950: '#0b211c',
        },
        accent: {
          50: '#edfdf7',
          100: '#d3fbeb',
          200: '#aaf5da',
          300: '#60f2c4',
          400: '#3de0ae',
          500: '#14c896',
          600: '#09a37a',
          700: '#088364',
          800: '#0a6750',
          900: '#0a5543',
          950: '#033027',
        },
        charcoal: {
          DEFAULT: '#2b323a',
          light: '#3a424c',
          dark: '#212121',
        },
      },
      fontFamily: {
        heading: ['Fraunces', 'Georgia', 'serif'],
        body: ['Lato', 'system-ui', 'sans-serif'],
        sans: ['Lato', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
