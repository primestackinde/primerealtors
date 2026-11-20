/**
 * The canonical list of indexable static pages: one entry per public route,
 * carrying the metadata the SEO component renders and the sitemap publishes.
 *
 * When a new public route is added to App.jsx it must be added here too, or it
 * will be treated as a 404 by both the sitemap and the meta tag resolver.
 */
export const SITE_PAGES = [
  {
    path: '/',
    title: 'Prime Realtors | Janaharsha – Buy & Sell Verified Plots in Hyderabad',
    description:
      'Prime Realtors offers verified residential, farmhouse, and investment plots across 2,000+ acres in Janaharsha and Ibrahimpatnam, Hyderabad. Expert guidance & guided site visits.',
    priority: '1.0',
    changefreq: 'weekly',
  },
  {
    path: '/buy-sell',
    title: 'Buy & Sell Verified Plots in Janaharsha | Prime Realtors',
    description:
      'Find your ideal plot in Janaharsha for farmhouse, investment, or future home, or list your land for sale with Prime Realtors trusted team.',
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/news-update',
    title: 'News & Development Updates from Janaharsha | Prime Realtors',
    description:
      'Stay updated with regional growth, highway connectivity, and land development milestones around Janaharsha and Ibrahimpatnam.',
    priority: '0.8',
    changefreq: 'weekly',
  },
  {
    path: '/our-presence',
    title: 'Our Presence in Janaharsha & Ibrahimpatnam | Prime Realtors',
    description:
      'Explore Prime Realtors presence across 2,000+ acres in Janaharsha, Ibrahimpatnam, Polkampally, and Raipole with established roads and teak plantations.',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/contact',
    title: 'Contact Prime Realtors | Book a Guided Site Visit in Janaharsha',
    description:
      'Get in touch with Kalyan, Srinivas, and Shiva at Prime Realtors. Call 80736 48872 or visit our Ibrahimpatnam office to explore Janaharsha plots.',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/faqs',
    title: 'Janaharsha Plot FAQs – Buying, Farmhouses & Land Use | Prime Realtors',
    description:
      'Answers to frequently asked questions about buying plots, legal registration, farmhouse planning, and investment in Janaharsha near Hyderabad.',
    priority: '0.8',
    changefreq: 'monthly',
    schemaType: 'FAQPage',
  },
  {
    path: '/gallery',
    title: 'Janaharsha Photo Gallery & Layout Views | Prime Realtors',
    description:
      'Browse photos of Janaharsha community, open horizons, lakes, parks, and planned layouts near Ramoji Film City, Hyderabad.',
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | Prime Realtors Janaharsha',
    description:
      'Read the privacy policy of Prime Realtors Janaharsha regarding client information handling and inquiry privacy.',
    priority: '0.3',
    changefreq: 'yearly',
  },
  {
    path: '/terms-and-conditions',
    title: 'Terms & Conditions | Prime Realtors Janaharsha',
    description:
      'Read our terms and conditions regarding plot consultancy, site visits, and property transactions with Prime Realtors.',
    priority: '0.3',
    changefreq: 'yearly',
  },
  {
    path: '/thank-you',
    title: 'Thank You for Your Enquiry | Prime Realtors',
    description:
      'Your enquiry has been received. The Prime Realtors team will connect with you shortly regarding Janaharsha plots.',
    priority: '0.1',
    changefreq: 'yearly',
    robots: 'noindex',
    sitemap: false,
  },
]

/** Look up the static metadata for a pathname, or null for unknown routes. */
export function findSitePage(pathname) {
  return SITE_PAGES.find((page) => page.path === pathname) || null
}

/** Static pages that belong in the sitemap. */
export function sitemapPages() {
  return SITE_PAGES.filter((page) => page.sitemap !== false)
}
