/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["yt-search", "cheerio"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
      { protocol: "https", hostname: "*.scdn.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.mzstatic.com" },
      { protocol: "https", hostname: "*.saavncdn.com" },
    ],
  },
};

module.exports = nextConfig;
