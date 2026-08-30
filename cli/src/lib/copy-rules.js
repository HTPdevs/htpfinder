/**
 * Copy rules from CLAUDE.md, applied at the prospect level so a violation is
 * caught before a site is ever built.
 *
 * The dash class is built from code points on purpose. Writing the characters
 * inline means a find and replace pass over the repo can silently empty the
 * class, which has already happened once.
 */
const DASH_CODEPOINTS = [
  0x2d, // hyphen minus
  0x2010, // hyphen
  0x2011, // non breaking hyphen
  0x2012, // figure dash
  0x2013, // en dash
  0x2014, // em dash
  0x2015, // horizontal bar
  0x2212, // minus sign
]

/** Every dash character, as a string. Built from the code points above. */
export const DASH_CHARS = DASH_CODEPOINTS.map((code) => String.fromCodePoint(code)).join('')

export const DASH_PATTERN = new RegExp(`[${DASH_CHARS}]`)

export const BANNED_WORDS = [
  'delve',
  'tapestry',
  'pivotal',
  'realm',
  'underscore',
  'multifaceted',
  'nuanced',
  'harness',
  'elevate',
  'resonate',
]

/**
 * Phone numbers keep their separator. The no dashes rule governs prose, and
 * reformatting a phone number into something unrecognisable helps nobody.
 */
const PHONE_PATTERN = new RegExp(
  `\\(?\\d{3}\\)?[\\s.]?\\d{3}[${DASH_CHARS}]\\d{4}`,
  'g'
)

export function stripExempt(text) {
  return String(text).replace(PHONE_PATTERN, 'PHONE')
}

export function findDashes(text) {
  return DASH_PATTERN.test(stripExempt(text))
}

export function findBannedWords(text) {
  const haystack = String(text)
  return BANNED_WORDS.filter((word) => new RegExp(`\\b${word}`, 'i').test(haystack))
}

/** Walks any nested value and yields every string with a dotted path. */
export function* walkStrings(value, trail = []) {
  if (typeof value === 'string') {
    yield { path: trail.join('.'), text: value }
    return
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) yield* walkStrings(item, [...trail, index])
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) yield* walkStrings(item, [...trail, key])
  }
}
