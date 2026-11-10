/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@app/contracts'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
