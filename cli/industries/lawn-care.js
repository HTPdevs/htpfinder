/**
 * Industry profile: lawn and yard maintenance.
 *
 * Everything vertical specific lives in files like this one. The collector,
 * the enrichment prompt, the validator and the renderer all read from here,
 * so adding a trade never means editing a component or a script.
 */
export default {
  id: 'lawn-care',
  label: 'Lawn and yard maintenance',

  places: {
    // Category filters plus free text variants. Places categories are coarse,
    // so the keyword sweep catches operators the category misses.
    includedTypes: ['lawn_care_service', 'landscaper', 'gardener'],
    keywords: [
      'lawn care',
      'lawn maintenance',
      'yard maintenance',
      'landscaping',
      'landscape maintenance',
      'yard service',
    ],
  },

  /**
   * A prospect is worth agent time when they clearly have customers but no
   * website. Thresholds are per industry because review volume means very
   * different things in different trades.
   */
  qualify: {
    minRating: 3.5,
    minReviews: 3,
    // Below this, there is not enough public signal to write an honest page.
    idealReviews: 20,
  },

  /**
   * Where the fields Places does not carry actually live for this trade:
   * years in business, crew size, payment methods, owner name, service lists.
   * Ordered by how often they paid off in the Portland pass.
   */
  directories: [
    'homeguide.com',
    'angi.com',
    'homeadvisor.com',
    'bbb.org',
    'networx.com',
    'thumbtack.com',
    'yelp.com',
    'manta.com',
    'houzz.com',
  ],

  /** Normalizes wording so two prospects do not describe the same job differently. */
  serviceTaxonomy: [
    { key: 'mowing', label: 'Mowing and edging', icon: 'Scissors' },
    { key: 'trimming', label: 'Shrub and hedge trimming', icon: 'Leaf' },
    { key: 'cleanup', label: 'Yard cleanups', icon: 'Trash2' },
    { key: 'leaf-removal', label: 'Leaf removal', icon: 'Leaf' },
    { key: 'tree-work', label: 'Tree trimming and removal', icon: 'TreeDeciduous' },
    { key: 'sod', label: 'Sod installation', icon: 'Sprout' },
    { key: 'mulch', label: 'Mulching and bark dust', icon: 'Shovel' },
    { key: 'irrigation', label: 'Sprinkler installation and repair', icon: 'Droplets' },
    { key: 'design', label: 'Landscape design', icon: 'Layers' },
    { key: 'gardening', label: 'Gardening and planting', icon: 'Flower2' },
    { key: 'hardscape', label: 'Hardscaping and pavers', icon: 'Hammer' },
    { key: 'fencing', label: 'Fencing', icon: 'Fence' },
    { key: 'turf', label: 'Artificial turf', icon: 'Fence' },
    { key: 'pressure-washing', label: 'Pressure washing', icon: 'Sparkles' },
    { key: 'gutters', label: 'Gutter cleaning', icon: 'Wrench' },
    { key: 'delivery', label: 'Material delivery', icon: 'Truck' },
    { key: 'holiday-lights', label: 'Holiday light installation', icon: 'Lightbulb' },
    { key: 'weed-control', label: 'Weed control', icon: 'Sprout' },
    { key: 'fertilization', label: 'Fertilization and aeration', icon: 'Sprout' },
    { key: 'snow', label: 'Snow removal', icon: 'Shovel' },
  ],

  design: {
    motif: 'mow-stripes',
    mark: 'leaf',
    paletteFamilies: ['autumn-leaves', 'spring-flowers', 'summer', 'icy-blue'],
  },

  /**
   * Guidance handed to the agent during enrichment. This is the difference
   * between a page about a category and a page about a business.
   */
  guidance: {
    audience:
      'Homeowners and small property managers choosing a crew for recurring work. They care about showing up when promised, tidy finishes, and a price that does not move.',
    proofPoints: [
      'Years in business, which in this trade is the strongest single credential',
      'Crew size, since a small steady crew is a selling point rather than a limitation',
      'Free estimates and whether travel is charged',
      'Owner name, when the owner is the one doing the work',
      'Payment methods, especially informal ones like Venmo or Zelle',
    ],
    anglesToAvoid: [
      'Generic sustainability claims unless the business actually advertises them',
      'Implying licensing, bonding or insurance that was not found in a listing',
      'Any suggestion of crew size or equipment beyond what a source states',
    ],
    seasonalNote:
      'Work is seasonal. Spring cleanups, summer mowing, autumn leaves and winter storm damage are all legitimate angles depending on when outreach happens.',
  },
}
