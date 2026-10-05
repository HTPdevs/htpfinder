/**
 * Plumbing industry profile.
 *
 * Scaffolded by `htpfinder profile plumbing`, and not researched yet. Every
 * value below is a placeholder, so this shows up under `htpfinder industries`
 * as started rather than usable. Run that same command again for the brief
 * that says what each field needs and where the answers come from.
 */
export default {
  id: 'plumbing',
  label: 'Plumbing',

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

  /**
   * The trade in the words a sentence would use, lowercase, two or three
   * words: "lawn care", "auto repair". Automated enrichment writes prose with
   * it. Left out, it falls back to the label, which reads like a heading in
   * the middle of a sentence.
   */
  copy: {
    trade: '',
  },

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
