
import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // You can add other Next.js configurations here if needed.
};

const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
};

// The 'withPWA' function needs to be called with the PWA config,
// and it returns a new function that you then call with the Next.js config.
export default withPWA(pwaConfig)(nextConfig);
