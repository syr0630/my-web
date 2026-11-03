/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/my-web',
  assetPrefix: '/my-web/',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

