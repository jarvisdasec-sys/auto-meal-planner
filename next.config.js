/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Tier 1 — retailer CDNs
      { protocol: 'https', hostname: 'i5.walmartimages.com' },
      { protocol: 'https', hostname: 'i5.walmartimages.ca' },
      { protocol: 'https', hostname: 'www.kroger.com' },
      { protocol: 'https', hostname: 'kroger.com' },
      // Tier 2 — Open Food Facts UPC match
      { protocol: 'https', hostname: 'images.openfoodfacts.org' },
      { protocol: 'https', hostname: 'static.openfoodfacts.org' },
      // Tier 3 — generic ingredient imagery
      { protocol: 'https', hostname: 'img.spoonacular.com' },
      { protocol: 'https', hostname: 'spoonacular.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

module.exports = nextConfig;
