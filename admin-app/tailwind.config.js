/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        espresso: {
          50: '#f7f1eb',
          100: '#f0e6dc',
          200: '#d8c2a7',
          300: '#ba8f60',
          400: '#9a6f46',
          500: '#7d5436',
          600: '#66412d',
          700: '#4d3123',
          800: '#2d1f1a',
          900: '#1a0f08',
        },
        brew: {
          50: '#fef3e7',
          100: '#fce7cd',
          200: '#f7cb8d',
          300: '#f0b15a',
          400: '#dd8a2d',
          500: '#c96b18',
          600: '#9b4d13',
        },
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(26,15,8,0.08)',
      },
    },
  },
  plugins: [],
};
