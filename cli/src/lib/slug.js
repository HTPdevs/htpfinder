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

/** Adds a numeric suffix when a slug is already taken. */
export function uniqueSlug(name, taken = []) {
  const base = slugify(name) || 'prospect'
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
