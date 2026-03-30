/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // fhenixjs uses Node crypto — keep server-side only
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

module.exports = nextConfig;
