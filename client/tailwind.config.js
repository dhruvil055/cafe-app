/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brew: {
          50: '#fdf8f0',
          100: '#faefd8',
          200: '#f3d9a8',
          300: '#e9be6e',
          400: '#dfa040',
          500: '#d4862a',
          600: '#b96a20',
          700: '#98511c',
          800: '#7c411e',
          900: '#66361c',
        },
        espresso: {
          50: '#f5f0eb',
          100: '#e8dcd0',
          200: '#d1b9a1',
          300: '#b89269',
          400: '#a37445',
          500: '#8a5e35',
          600: '#6e4a2a',
          700: '#573b22',
          800: '#45301d',
          900: '#1a0f08',
          950: '#0d0804',
        },
        cream: '#FAF6F0',
        foam: '#F0E8D8',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'steam': 'steam 2s ease-in-out infinite',
        'fade-up': 'fadeUp 0.5s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        steam: {
          '0%': { opacity: 0, transform: 'translateY(0) scaleX(1)' },
          '50%': { opacity: 1, transform: 'translateY(-10px) scaleX(1.2)' },
          '100%': { opacity: 0, transform: 'translateY(-20px) scaleX(0.8)' },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
