/**
 * Industry profile template.
 *
 * Copy this to `<your-industry>.js`, fill every section, and the collector,
 * enrichment prompt, validator and renderer all pick it up. Files starting
 * with an underscore are ignored by the profile loader.
 *
 * The two shipped profiles, lawn-care.js and auto-repair.js, are worth reading
 * first. They differ in almost every value, which is the point.
 */
export default {
  id: 'your-industry',
  label: 'Human readable name',

  places: {
    // Google Places categories. Coarse on purpose, so pair with keywords.
    includedTypes: [],
    // Free text searches run alongside the category sweep.
    keywords: [],
  },

  qualify: {
    // Tune these to the trade. Review volume means different things in
    // different industries, so do not copy another profile's numbers.
    minRating: 3.5,
    minReviews: 5,
    idealReviews: 50,
  },

  /**
   * Where the facts Places does not carry actually live for this trade.
   * Find these by researching three businesses by hand first. Guessing the
   * directory list is the fastest way to make the tool bad at an industry.
   */
  directories: [],

  /**
   * The research pass the two fields above came out of.
   *
   * This exists so "did anyone actually check" is answerable by a machine
   * rather than by trust. `htpfinder industries` reports a directory that no
   * researched business was found on, which is the signature of a list that was
   * guessed. `reviews` is the observed count, and it is what `qualify` above
   * has to be justified by.
   */
  research: {
    date: '',
    businesses: [
      // { name: '', url: '', reviews: 0, foundOn: ['example.com'] },
    ],
  },

  /** Normalized service vocabulary. `icon` must exist in the renderer registry. */
  serviceTaxonomy: [
    // { key: 'example', label: 'Example service', icon: 'Wrench' },
  ],

  design: {
    // Hero texture and header mark, both implemented in the demos renderer.
    motif: 'plain',
    mark: 'leaf',
    // Constrain to families that suit the trade rather than allowing all four.
    paletteFamilies: ['autumn-leaves', 'spring-flowers', 'summer', 'icy-blue'],
  },

  guidance: {
    audience: '',
    proofPoints: [],
    anglesToAvoid: [],
    seasonalNote: '',
  },
}
