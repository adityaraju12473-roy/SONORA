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
        background: {
          DEFAULT: '#06060a',
          subtle: '#0a0a10',
          card: '#0f0f18',
          elevated: '#141422',
          highlight: '#1c1c2e',
        },
        cyber: {
          cyan: '#00f0ff',
          neon: '#00ffcc',
          pink: '#ff007f',
          magenta: '#e024c3',
          purple: '#9d4edd',
          violet: '#7928ca',
          amber: '#ffb703',
          dark: '#06060a',
          card: '#0d0d15',
          border: 'rgba(0, 240, 255, 0.15)',
          'border-pink': 'rgba(255, 0, 127, 0.25)',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Emerald
          600: '#059669',
          700: '#047857',
          neon: '#00f59b', // Electric mint/neon
          cyan: '#00f0ff',
          violet: '#8b5cf6',
          purple: '#a855f7',
        },
        sonora: {
          border: 'rgba(255, 255, 255, 0.08)',
          'border-hover': 'rgba(255, 255, 255, 0.16)',
          glass: 'rgba(12, 12, 20, 0.72)',
          'glass-elevated': 'rgba(18, 18, 30, 0.85)',
          muted: '#8e8e9f',
          text: '#f4f4f8',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Space Grotesk', 'Cabinet Grotesk', 'sans-serif'],
        cyber: ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sound-wave': 'soundWave 1.2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'holo-shimmer': 'holoShimmer 6s linear infinite',
        'cyber-glow': 'cyberGlow 2.5s ease-in-out infinite alternate',
      },
      keyframes: {
        soundWave: {
          '0%': { height: '20%' },
          '100%': { height: '100%' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        holoShimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        cyberGlow: {
          '0%': { opacity: '0.4', filter: 'drop-shadow(0 0 15px rgba(0,240,255,0.4))' },
          '100%': { opacity: '0.8', filter: 'drop-shadow(0 0 25px rgba(255,0,127,0.6))' },
        },
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
