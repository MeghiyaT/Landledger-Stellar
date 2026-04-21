/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E293B',
        },
        secondary: {
          DEFAULT: '#059669',
        },
        accent: {
          DEFAULT: '#DC2626',
        },
        gray: {
          900: '#0F172A',
          700: '#334155',
          400: '#94A3B8',
          100: '#F1F5F9',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // 8-point scale - extending default Tailwind spacing
        '18': '72px',
        '20': '80px',
        '24': '96px',
        '32': '128px',
      },
      borderRadius: {
        'DEFAULT': '8px',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0,0,0,0.05)',
        'elevated': '0 4px 6px rgba(0,0,0,0.1)',
        'modal': '0 20px 25px rgba(0,0,0,0.15)',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
    },
  },
  plugins: [],
}

