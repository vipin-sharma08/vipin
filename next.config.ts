import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // the Bengaluru city page is a self-contained static file
  async rewrites() {
    return [{ source: '/city', destination: '/city.html' }];
  },
};

export default config;
