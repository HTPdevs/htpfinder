/**
 * Header mark. Which one renders comes from the industry profile via
 * `design.mark` in the generated site data, so a new trade never means
 * editing a component.
 */
const MARKS = {
  leaf: (
    <>
      <path d="M4 20c0-8 5.5-13 16-13 0 9.5-5.5 14-12 14H4Z" fill="currentColor" opacity="0.9" />
      <path
        d="M4 20C7 14.5 11.5 10.8 17 8.6"
        stroke="hsl(var(--brand-ink))"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  wrench: (
    <>
      <path
        d="M15.5 3.5a5 5 0 0 0-6.1 6.4l-6 6a2 2 0 0 0 2.8 2.8l6-6a5 5 0 0 0 6.4-6.1l-3 3-2.1-2.1 3-3Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="6.6" cy="17.4" r="0.9" fill="hsl(var(--brand-ink))" />
    </>
  ),
  roof: (
    <>
      <path d="M12 4 3 11h2.5v8h13v-8H21L12 4Z" fill="currentColor" opacity="0.9" />
      <path d="M9 19v-4.5h6V19" stroke="hsl(var(--brand-ink))" strokeWidth="1.5" fill="none" />
    </>
  ),
  spark: (
    <>
      <path
        d="M12 2.5 14.2 9l6.5 2.2-6.5 2.2L12 20l-2.2-6.6L3.3 11.2 9.8 9 12 2.5Z"
        fill="currentColor"
        opacity="0.9"
      />
    </>
  ),
}

export function BrandMark({ name = 'leaf' }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[1.15em]" fill="none" aria-hidden="true">
      {MARKS[name] || MARKS.leaf}
    </svg>
  )
}
