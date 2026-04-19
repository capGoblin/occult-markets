/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    // fhenixjs uses Node crypto — keep server-side only
    config.resolve.fallback = { 
      ...config.resolve.fallback, 
      fs: false, 
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false 
    };
    return config;
  },
};

module.exports = nextConfig;
