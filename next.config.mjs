/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy Solana/Metaplex packages out of the server bundle.
  experimental: {
    serverComponentsExternalPackages: [
      "@solana/web3.js",
      "@metaplex-foundation/umi",
      "@metaplex-foundation/umi-bundle-defaults",
      "@metaplex-foundation/mpl-core",
      "@meteora-ag/dynamic-bonding-curve-sdk",
      "pg",
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default nextConfig;
