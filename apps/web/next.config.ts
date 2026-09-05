import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  transpilePackages: ['@mas/ui', '@mas/domain', '@mas/mock-data', '@mas/connectors', '@mas/messages'],
  // No telemetry, no external requests: the app runs offline.
  productionBrowserSourceMaps: false,
};

export default config;
