/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // RedNest Design System
        rn: {
          bg:        '#050816',
          surface:   '#0B1020',
          border:    'rgba(255,255,255,0.05)',
          text:      '#E6EAF2',
          muted:     '#8A93A8',
          purple:    '#7C3AED',
          blue:      '#2563EB',
          cyan:      '#06B6D4',
          green:     '#22C55E',
          yellow:    '#EAB308',
          red:       '#EF4444',
        },
        // Shadcn compatible
        background:  '#050816',
        foreground:  '#E6EAF2',
        card: {
          DEFAULT:   '#0B1020',
          foreground:'#E6EAF2',
        },
        popover: {
          DEFAULT:   '#0B1020',
          foreground:'#E6EAF2',
        },
        primary: {
          DEFAULT:   '#7C3AED',
          foreground:'#E6EAF2',
        },
        secondary: {
          DEFAULT:   '#0B1020',
          foreground:'#8A93A8',
        },
        muted: {
          DEFAULT:   '#0B1020',
          foreground:'#8A93A8',
        },
        accent: {
          DEFAULT:   '#7C3AED',
          foreground:'#E6EAF2',
        },
        destructive: {
          DEFAULT:   '#EF4444',
          foreground:'#E6EAF2',
        },
        border:      'rgba(255,255,255,0.08)',
        input:       'rgba(255,255,255,0.05)',
        ring:        '#7C3AED',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      boxShadow: {
        'glow-purple': '0 0 12px rgba(124,58,237,0.4)',
        'glow-cyan':   '0 0 12px rgba(6,182,212,0.4)',
        'glow-red':    '0 0 12px rgba(239,68,68,0.4)',
        'glow-green':  '0 0 12px rgba(34,197,94,0.4)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash':      'flash 1s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
