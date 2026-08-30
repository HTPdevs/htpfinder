/**
 * The `> HTP_` brand system, as Tailwind tokens.
 *
 * htpfinder is an HTP sub brand, so the background, the type roles and the
 * layout language come from the master brand and are not this tool's to
 * reinvent. What differs is the accent, and here that is `signal`: an amber
 * dark and bright pair standing in for the master teal, on this tool's own
 * surfaces only. The name is the point, since finding signal in noise is what
 * this thing does.
 *
 * `ok` is not a second accent. It is a functional status colour, and it exists
 * because three places had teal meaning "this is fine" sitting next to amber
 * meaning something else: a note that succeeded beside one that warns, a
 * prospect that is stored beside one that is not, a status further along beside
 * one earlier. Making both amber would have made those pairs unreadable.
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
        // The accent. Dark for depth and selection, bright for primary actions
        // and highlights, light for the lift on hover.
        signal: {
          DEFAULT: '#F0B429',
          light: '#F7C948',
          deep: '#7C4D0A',
          wash: 'rgba(240, 180, 41, 0.10)',
          dim: 'rgba(240, 180, 41, 0.16)',
        },
        ok: {
          DEFAULT: '#49C68A',
          wash: 'rgba(73, 198, 138, 0.10)',
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
