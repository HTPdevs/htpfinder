/**
 * The `> HTP_` brand system, as Tailwind tokens.
 *
 * Background, teal pair and type roles come from the master brand and are not
 * this tool's to reinvent. htpfinder's own accent is `signal`, an amber used
 * only for the prospect score, which is the one number this tool exists to
 * produce. It never appears on a shared surface, so it cannot compete with the
 * master teal.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#121212',
          raised: '#181818',
          panel: '#1C1C1C',
          line: '#2A2A2A',
          hover: '#222222',
        },
        teal: {
          deep: '#0F5C57',
          bright: '#22D3C5',
          wash: 'rgba(34, 211, 197, 0.10)',
        },
        signal: {
          DEFAULT: '#F0B429',
          dim: 'rgba(240, 180, 41, 0.14)',
        },
        alert: '#F87171',
        text: {
          DEFAULT: '#EDEDED',
          muted: '#8A8A8A',
          faint: '#5C5C5C',
        },
      },
      fontFamily: {
        display: ['Cabinet Grotesk', 'Satoshi', 'system-ui', 'sans-serif'],
        body: ['Satoshi', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Hack Nerd Font Mono', 'Hack', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        panel: '10px',
      },
    },
  },
  plugins: [],
}
