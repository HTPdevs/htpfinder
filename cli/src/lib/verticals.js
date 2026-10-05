/**
 * Verticals for the inbox pipeline.
 *
 * These are deliberately not `industries/*.js` profiles. An industry profile
 * carries a service taxonomy, a directory list and a design motif, all of
 * which exist to render a demo site for a business that has no website. This
 * pipeline targets the opposite business: one that has a site, has channels,
 * and cannot keep up with them. None of those fields apply, and adding an
 * industry profile with seven empty required keys to get a keyword list would
 * make the profile validator lie about what has been researched.
 *
 * `search` is the text handed to the business search provider. `staffBand` is
 * the headcount the offer is priced for. `context` is the note that explains
 * why the vertical drowns in messages, which is what the outreach opens with.
 */
export const VERTICALS = {
  dental: {
    id: 'dental',
    label: 'Dental clinics',
    search: ['dental clinics', 'dentist office', 'family dentistry practice'],
    staffBand: [10, 50],
    context:
      'Front desk answers phone, email, Facebook and Instagram from one chair while chairside. ' +
      'Weave, Podium and Solutionreach are the incumbents worth switching.',
  },
  'med-spa': {
    id: 'med-spa',
    label: 'Med spas',
    search: ['med spa', 'medical spa aesthetics clinic', 'botox and filler clinic'],
    staffBand: [10, 50],
    context:
      'Instagram is the main sales channel and the DMs are the pipeline, usually on a personal phone. ' +
      'Boulevard, Zenoti and Podium are the incumbents.',
  },
  'auto-dealer': {
    id: 'auto-dealer',
    label: 'Auto dealers',
    search: ['car dealership', 'used car dealer', 'auto dealership sales'],
    staffBand: [10, 50],
    context:
      'Every lead source has its own inbox and the response clock is the whole game. ' +
      'Gubagoo, CarNow and ActivEngage are the incumbents.',
  },
  'home-services': {
    id: 'home-services',
    label: 'Home services',
    search: ['hvac company', 'plumbing company', 'roofing contractor'],
    staffBand: [10, 50],
    context:
      'Dispatch runs on phone calls and texts to individual technicians, with no shared record of who said what.',
  },
}

export function listVerticalIds() {
  return Object.keys(VERTICALS).sort()
}

export function loadVertical(id) {
  const vertical = VERTICALS[id]
  if (!vertical) {
    throw new Error(
      `Unknown vertical "${id}". Available: ${listVerticalIds().join(', ')}\n` +
        'Add one in cli/src/lib/verticals.js'
    )
  }
  return vertical
}
