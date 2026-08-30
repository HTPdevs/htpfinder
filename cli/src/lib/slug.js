const STOP_SUFFIXES = /\b(llc|l\.l\.c|inc|incorporated|co|corp|ltd|company)\b/gi

export function slugify(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, ' and ')
    // Drop apostrophes rather than turning them into separators, so
    // "Kevin's Landscaping" slugs as kevins, not kevin-s.
    .replace(/['’ʼ]/g, '')
    .replace(STOP_SUFFIXES, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/**
 * Words that stay lowercase inside a title, unless they open it.
 *
 * Kept short on purpose. A trade name is two or three words, so the usual long
 * style guide list would only add ways to get "Lawn And Yard" wrong.
 */
const MINOR_WORDS = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'for', 'to', 'in'])

/**
 * A readable trade name from an industry id.
 *
 * Only used when a profile is missing or half written. A shipped profile
 * carries its own label, and that always wins.
 */
export function labelFromSlug(slug) {
  return String(slug)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ')
}

/** Adds a numeric suffix when a slug is already taken. */
export function uniqueSlug(name, taken = []) {
  const base = slugify(name) || 'prospect'
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
