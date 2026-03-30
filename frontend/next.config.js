/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // fhenixjs uses Node crypto — keep server-side only
    config.resolve.fallback = { 
      ...config.resolve.fallback, 
      fs: false, 
      "@react-native-async-storage/async-storage": false 
    };
    return config;
  },
};

module.exports = nextConfig;
