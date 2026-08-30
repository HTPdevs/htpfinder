/**
 * Shared palette library.
 *
 * CLAUDE.md constrains demo palettes to four seasonal families and requires
 * that colors inside a demo never clash. Rather than ask an agent to invent
 * HSL values per prospect, every palette is derived from a small seed by one
 * function, so the relationships between ground, brand, and highlight are
 * identical everywhere and only the hues move.
 *
 * A prospect picks a palette by id. Two prospects in the same city should not
 * share one, which `suggestPalette` handles by skipping ids already in use.
 */

const clampL = (value) => Math.max(0, Math.min(100, Math.round(value)))

/**
 * @param {object} seed
 * @param {number} seed.brandH   hue of the primary brand color
 * @param {number} seed.brandS   saturation of the brand color
 * @param {number} seed.brandL   lightness of the brand color
 * @param {number} seed.groundH  hue of the page ground, usually near the brand
 * @param {number} seed.groundS  saturation of the page ground
 * @param {number} seed.hiH      highlight hue, used for ratings and small emphasis
 * @param {number} seed.hiS
 * @param {number} seed.hiL
 */
function derive(seed) {
  const { brandH, brandS, brandL, groundH, groundS, hiH, hiS, hiL } = seed
  const hsl = (h, s, l) => `${((h % 360) + 360) % 360} ${Math.round(s)}% ${clampL(l)}%`

  return {
    background: hsl(groundH, groundS, 96.5),
    foreground: hsl(brandH + 4, Math.min(30, brandS * 0.6), 15),

    card: '0 0% 100%',
    'card-foreground': hsl(brandH + 4, Math.min(30, brandS * 0.6), 15),

    primary: hsl(brandH, brandS, brandL),
    'primary-foreground': hsl(groundH, groundS + 6, 97),

    secondary: hsl(groundH - 4, groundS * 0.72, 92),
    'secondary-foreground': hsl(brandH + 4, Math.min(30, brandS * 0.6), 21),

    muted: hsl(groundH - 2, groundS * 0.86, 94.5),
    'muted-foreground': hsl(brandH + 6, Math.max(9, brandS * 0.26), 40),

    accent: hsl(groundH - 4, groundS * 0.72, 91),
    'accent-foreground': hsl(brandH + 4, Math.min(30, brandS * 0.6), 21),

    border: hsl(groundH - 4, groundS * 0.6, 86),
    input: hsl(groundH - 4, groundS * 0.6, 83),
    ring: hsl(brandH, brandS, brandL + 7),

    brand: hsl(brandH, brandS, brandL),
    'brand-soft': hsl(brandH + 12, Math.max(30, brandS * 0.9), 90),
    'brand-ink': hsl(brandH + 2, Math.max(30, brandS * 0.82), 16),
    highlight: hsl(hiH, hiS, hiL),
  }
}

/**
 * Seeds only. Everything else is derived, so a new palette is four hues and
 * cannot accidentally break the contrast relationships the layout relies on.
 */
const SEEDS = [
  // Autumn leaves: warm earth grounds, brass and ember highlights.
  { id: 'autumn-sienna', family: 'autumn-leaves', label: 'Burnt sienna and brass',
    seed: { brandH: 18, brandS: 58, brandL: 33, groundH: 36, groundS: 38, hiH: 36, hiS: 78, hiL: 42 },
    radius: '0.75rem', stripeAngle: '16deg', stripeWidth: '30px' },
  { id: 'autumn-oak', family: 'autumn-leaves', label: 'Deep oak and amber',
    seed: { brandH: 28, brandS: 44, brandL: 27, groundH: 40, groundS: 30, hiH: 42, hiS: 72, hiL: 40 },
    radius: '0.5rem', stripeAngle: '-11deg', stripeWidth: '24px' },
  { id: 'autumn-ember', family: 'autumn-leaves', label: 'Ember red and ochre',
    seed: { brandH: 8, brandS: 52, brandL: 34, groundH: 30, groundS: 34, hiH: 32, hiS: 70, hiL: 44 },
    radius: '1rem', stripeAngle: '21deg', stripeWidth: '26px' },

  // Fields of flowers in spring: cool pastel grounds, fresh green highlights.
  { id: 'spring-lupine', family: 'spring-flowers', label: 'Lupine violet and meadow',
    seed: { brandH: 262, brandS: 30, brandL: 41, groundH: 265, groundS: 30, hiH: 96, hiS: 42, hiL: 36 },
    radius: '0.5rem', stripeAngle: '-13deg', stripeWidth: '21px' },
  { id: 'spring-meadow', family: 'spring-flowers', label: 'Meadow green and buttercup',
    seed: { brandH: 128, brandS: 32, brandL: 30, groundH: 96, groundS: 28, hiH: 46, hiS: 66, hiL: 42 },
    radius: '0.75rem', stripeAngle: '14deg', stripeWidth: '28px' },
  { id: 'spring-blossom', family: 'spring-flowers', label: 'Blossom rose and leaf',
    seed: { brandH: 340, brandS: 28, brandL: 38, groundH: 348, groundS: 26, hiH: 118, hiS: 38, hiL: 34 },
    radius: '1rem', stripeAngle: '-18deg', stripeWidth: '23px' },

  // Summer: saturated warm grounds, deep shade brands.
  { id: 'summer-pine', family: 'summer', label: 'Deep pine and sun',
    seed: { brandH: 152, brandS: 44, brandL: 24, groundH: 84, groundS: 32, hiH: 38, hiS: 74, hiL: 44 },
    radius: '0.75rem', stripeAngle: '18deg', stripeWidth: '30px' },
  { id: 'summer-clay', family: 'summer', label: 'Warm clay and sky',
    seed: { brandH: 12, brandS: 40, brandL: 36, groundH: 34, groundS: 30, hiH: 196, hiS: 52, hiL: 38 },
    radius: '0.5rem', stripeAngle: '-15deg', stripeWidth: '25px' },
  { id: 'summer-teak', family: 'summer', label: 'Teak and citrus',
    seed: { brandH: 42, brandS: 46, brandL: 28, groundH: 52, groundS: 34, hiH: 74, hiS: 54, hiL: 34 },
    radius: '1rem', stripeAngle: '12deg', stripeWidth: '27px' },

  // Icy blue: cool grey blue grounds, steel and slate brands.
  { id: 'icy-glacier', family: 'icy-blue', label: 'Glacier blue and steel',
    seed: { brandH: 205, brandS: 44, brandL: 32, groundH: 205, groundS: 30, hiH: 188, hiS: 56, hiL: 36 },
    radius: '0.5rem', stripeAngle: '-16deg', stripeWidth: '22px' },
  { id: 'icy-slate', family: 'icy-blue', label: 'Slate and frost',
    seed: { brandH: 220, brandS: 30, brandL: 30, groundH: 216, groundS: 24, hiH: 200, hiS: 48, hiL: 40 },
    radius: '0.75rem', stripeAngle: '19deg', stripeWidth: '29px' },
  { id: 'icy-harbor', family: 'icy-blue', label: 'Harbor navy and ice',
    seed: { brandH: 232, brandS: 34, brandL: 28, groundH: 222, groundS: 26, hiH: 192, hiS: 50, hiL: 42 },
    radius: '1rem', stripeAngle: '-12deg', stripeWidth: '26px' },
]

export const PALETTES = SEEDS.map((entry) => ({
  id: entry.id,
  family: entry.family,
  label: entry.label,
  radius: entry.radius,
  stripeAngle: entry.stripeAngle,
  stripeWidth: entry.stripeWidth,
  tokens: derive(entry.seed),
}))

export const PALETTE_FAMILIES = [...new Set(PALETTES.map((p) => p.family))]

export function getPalette(id) {
  return PALETTES.find((palette) => palette.id === id) || null
}

export function palettesInFamilies(families) {
  if (!families?.length) return PALETTES
  return PALETTES.filter((palette) => families.includes(palette.family))
}

/**
 * Picks a palette from the allowed families that no existing prospect is
 * already using. Falls back to least used once every option is taken.
 */
export function suggestPalette(families, taken = []) {
  const pool = palettesInFamilies(families)
  const free = pool.filter((palette) => !taken.includes(palette.id))
  if (!free.length) return leastUsed(pool, taken)

  // Spread across families before exhausting one. Two prospects sharing a
  // family look far more alike than two sharing nothing, so the first three
  // demos should be three different seasons rather than three autumns.
  const usedFamilies = new Set(
    taken.map((id) => getPalette(id)?.family).filter(Boolean)
  )
  const fromFreshFamily = free.find((palette) => !usedFamilies.has(palette.family))
  return fromFreshFamily || leastUsed(free, taken)
}

function leastUsed(pool, taken) {
  const counts = new Map(pool.map((palette) => [palette.id, 0]))
  taken.forEach((id) => counts.has(id) && counts.set(id, counts.get(id) + 1))
  return pool.reduce((best, palette) =>
    counts.get(palette.id) < counts.get(best.id) ? palette : best
  )
}
