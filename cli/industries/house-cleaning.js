/**
 * Industry profile: house cleaning and maid service.
 *
 * Researched against three real Portland, OR operators (see `research`
 * below): A and I House Cleaning, Rise and Shine Cleaning Service, and
 * House Calls By Magic Maid. Everything from `directories` to `qualify`
 * to the service list traces back to what those three actually showed.
 */
export default {
  id: 'house-cleaning',
  label: 'House Cleaning',

  places: {
    // Google Places (New) has no dedicated type for house cleaning or maid
    // service. Table A's closest neighbors, laundry, moving_company, are not
    // this trade, and the generic "service" type is too broad to filter
    // usefully. So this trade runs on the keyword sweep alone.
    includedTypes: [],
    keywords: [
      'house cleaning',
      'home cleaning',
      'maid service',
      'housekeeping',
      'residential cleaning',
      'deep cleaning service',
      'move out cleaning',
      'apartment cleaning',
    ],
  },

  /**
   * Every business in the research pass carried a 4.5 or higher rating on
   * every platform checked, well above the 3.5 floor used elsewhere. In a
   * trade built on letting a stranger into someone's home, a mediocre
   * rating is a much louder signal than in lawn care or auto repair.
   * Reviews accumulate fast here too: the newest operator researched, open
   * about a year, already had 20 on Yelp and 107 on Thumbtack.
   */
  qualify: {
    minRating: 4.0,
    minReviews: 8,
    idealReviews: 75,
  },

  /**
   * Ordered by how many of the three researched businesses each domain
   * actually answered a question for. BBB and Nextdoor answered for all
   * three, Yelp and Angi for two, Thumbtack and Birdeye for one apiece,
   * each with real detail (Thumbtack alone carried review count, rating,
   * years in business and crew size for A and I).
   */
  directories: [
    'bbb.org',
    'nextdoor.com',
    'yelp.com',
    'angi.com',
    'thumbtack.com',
    'birdeye.com',
  ],

  /**
   * The research pass the two fields above came out of. Three Portland, OR
   * businesses, checked by hand on August 28 2026.
   */
  research: {
    date: '2026-08-28',
    businesses: [
      {
        name: 'A and I House Cleaning',
        url: 'https://aihousescleaning.com/',
        reviews: 20,
        foundOn: ['yelp.com', 'bbb.org', 'thumbtack.com', 'nextdoor.com'],
      },
      {
        name: 'Rise and Shine Cleaning Service',
        url: 'https://shine-this.com/',
        reviews: 52,
        foundOn: ['yelp.com', 'bbb.org', 'nextdoor.com', 'angi.com'],
      },
      {
        name: 'House Calls By Magic Maid',
        url: 'https://www.housecallsbymagicmaid.com/',
        reviews: 28,
        foundOn: ['birdeye.com', 'angi.com', 'bbb.org', 'nextdoor.com'],
      },
    ],
  },

  /** Normalized service vocabulary, drawn from what the three researched sites actually list. */
  serviceTaxonomy: [
    { key: 'recurring', label: 'Recurring cleaning visits', icon: 'CalendarCheck' },
    { key: 'deep-clean', label: 'Deep cleaning', icon: 'Sparkles' },
    { key: 'move-in-out', label: 'Move in and move out cleaning', icon: 'Truck' },
    { key: 'post-construction', label: 'Post construction cleanup', icon: 'Hammer' },
    { key: 'commercial', label: 'Commercial and office cleaning', icon: 'Layers' },
    { key: 'vacation-rental', label: 'Vacation rental turnover cleaning', icon: 'Sparkles' },
    { key: 'windows', label: 'Interior window cleaning', icon: 'Droplets' },
    { key: 'appliances', label: 'Refrigerator and appliance detail', icon: 'Droplets' },
    { key: 'cabinets', label: 'Interior cabinet cleaning', icon: 'Layers' },
    { key: 'baseboards', label: 'Baseboard and trim detail', icon: 'Scissors' },
    { key: 'same-day', label: 'Same day and emergency cleaning', icon: 'Lightbulb' },
  ],

  /** The trade in the words a sentence would use, for generated copy. */
  copy: {
    trade: 'house cleaning',
  },

  design: {
    // Grid reads as tile and floor lines, a texture that fits a trade about
    // order and surfaces rather than the outdoor motifs the other trades use.
    motif: 'grid',
    // Spark reads as shine, and two of the three researched businesses put
    // "shine" directly in their own name. It is the trade's own word for itself.
    mark: 'spark',
    // Cleaning sells freshness and light, not the earthy, outdoor tones autumn
    // and summer carry. Icy blue and spring flowers stay in that register.
    paletteFamilies: ['icy-blue', 'spring-flowers'],
  },

  /**
   * Guidance handed to the agent during enrichment. This is the difference
   * between a page about a category and a page about a business.
   */
  guidance: {
    audience:
      'Homeowners and renters deciding whether to let someone into their home on a schedule. They care less about price than about who actually shows up, whether it is the same person each time, and what happens if something goes wrong.',
    proofPoints: [
      'Years in business, since trust with in home access is most of the sale',
      'Background checks and insurance, only when a source actually states them',
      'A consistent crew or the same person each visit, which cleaning customers mention more than almost anything else',
      'A satisfaction guarantee or free re clean policy, when a source states one',
      'Owner name, especially for small operators where the owner does or supervises the work',
    ],
    anglesToAvoid: [
      'Claiming bonding, insurance or background checks that no source actually stated',
      'Certification language such as green, eco friendly or certified clean that was not on a source',
      'Naming a specific crew member or promising who will show up when a source does not say',
      'Implying a state license this trade does not generally require',
    ],
    seasonalNote:
      'Demand rises before the winter holidays for deep cleans ahead of guests, again in spring for seasonal deep cleans, and around lease turnover dates in summer for move in and move out work.',
  },
}
