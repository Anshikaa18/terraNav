/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#090c0f',
        panel: '#11171b',
        'panel-alt': '#162024',
        line: '#29353a',
        'line-light': '#38484e',
        muted: '#8c9a9c',
        'muted-dark': '#586769',
        cyan: {
          DEFAULT: '#63e7ee',
          dim: 'rgba(99, 231, 238, 0.15)',
          glow: '#40dfe7',
        },
        amber: {
          DEFAULT: '#ffbf5c',
          dim: 'rgba(255, 191, 92, 0.15)',
        },
        green: {
          DEFAULT: '#61dfab',
          dim: 'rgba(97, 223, 171, 0.15)',
        },
        yellow: {
          DEFAULT: '#ecd568',
        },
        orange: {
          DEFAULT: '#ff9c55',
        },
        red: {
          DEFAULT: '#ff5d61',
        },
        brand: {
          50: '#e6fcfd',
          100: '#ccf9fc',
          200: '#9bf4f9',
          300: '#63e7ee',
          400: '#38dce4',
          500: '#17c0c9',
          600: '#0e9ba3',
          700: '#0e7c83',
          800: '#116267',
          900: '#135155',
          950: '#063134',
        },
        slate: {
          50: '#f6faf9',
          100: '#edf3f1',
          200: '#c6d2d0',
          300: '#adb9b8',
          400: '#8c9a9c',
          500: '#586769',
          600: '#38484e',
          700: '#29353a',
          800: '#1c262a',
          850: '#162024',
          900: '#11171b',
          950: '#090c0f',
        },
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'float': '0 12px 30px -4px rgba(0, 0, 0, 0.55)',
        'glow-cyan': '0 0 15px rgba(99, 231, 238, 0.35)',
        'glow-amber': '0 0 15px rgba(255, 191, 92, 0.35)',
        'glow-green': '0 0 15px rgba(97, 223, 171, 0.35)',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
