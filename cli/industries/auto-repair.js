/**
 * Industry profile: independent auto repair.
 *
 * The second profile exists to keep the abstraction honest. Note how little
 * it shares with lawn care: different Places categories, different directory
 * set, a much higher review bar, and completely different proof points.
 */
export default {
  id: 'auto-repair',
  label: 'Auto repair and service',

  places: {
    includedTypes: ['car_repair', 'auto_parts_store', 'car_dealer'],
    keywords: [
      'auto repair',
      'car repair',
      'auto service',
      'mechanic',
      'transmission repair',
      'brake repair',
      'import auto repair',
    ],
  },

  /**
   * Shops accumulate reviews far faster than lawn crews, so the bar is higher.
   * A shop with 12 reviews is new or struggling; a lawn crew with 12 is normal.
   */
  qualify: {
    minRating: 3.5,
    minReviews: 15,
    idealReviews: 100,
  },

  directories: [
    'repairpal.com',
    'yelp.com',
    'bbb.org',
    'napaautocare.com',
    'carfax.com',
    'yellowpages.com',
    'mechanicadvisor.com',
    'angi.com',
  ],

  serviceTaxonomy: [
    { key: 'diagnostics', label: 'Diagnostics', icon: 'Wrench' },
    { key: 'oil-change', label: 'Oil and fluid service', icon: 'Droplets' },
    { key: 'brakes', label: 'Brake service', icon: 'Wrench' },
    { key: 'engine', label: 'Engine repair', icon: 'Wrench' },
    { key: 'transmission', label: 'Transmission service', icon: 'Wrench' },
    { key: 'electrical', label: 'Electrical and battery', icon: 'Lightbulb' },
    { key: 'suspension', label: 'Suspension and steering', icon: 'Wrench' },
    { key: 'tires', label: 'Tires and alignment', icon: 'Wrench' },
    { key: 'ac', label: 'Heating and air conditioning', icon: 'Droplets' },
    { key: 'inspection', label: 'Inspections and emissions', icon: 'ShieldCheck' },
    { key: 'fleet', label: 'Fleet service', icon: 'Truck' },
    { key: 'scheduled-maintenance', label: 'Scheduled maintenance', icon: 'CalendarCheck' },
    { key: 'imports', label: 'Import specialists', icon: 'ShieldCheck' },
    { key: 'pre-purchase', label: 'Pre purchase inspection', icon: 'ShieldCheck' },
  ],

  design: {
    motif: 'diagonal-rule',
    mark: 'wrench',
    paletteFamilies: ['icy-blue', 'summer', 'autumn-leaves'],
  },

  guidance: {
    audience:
      'Drivers who have been burned by a shop before. They care about knowing the price before work starts, hearing about delays without having to call, and understanding what was actually done.',
    proofPoints: [
      'Years in business and whether it is family owned',
      'Certifications such as ASE, and affiliations such as NAPA AutoCare',
      'Warranty terms on parts and labor, which shops advertise and customers compare',
      'Loaner cars, shuttle service or after hours pickup',
      'Specialisation by make, which is a real differentiator for import owners',
    ],
    anglesToAvoid: [
      'Claiming certifications or warranty terms not stated in a source',
      'Naming specific makes a shop services without evidence',
      'Any implied dealership affiliation',
    ],
    seasonalNote:
      'Demand spikes around winter tire changes, pre road trip checks in early summer, and state inspection deadlines.',
  },
}
