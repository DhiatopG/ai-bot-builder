/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        // Force apex → www so you have ONE canonical origin
        // Fixes split-cookies / weird mobile behavior
        source: '/:path*',
        has: [{ type: 'host', value: 'in60second.net' }],
        destination: 'https://www.in60second.net/:path*',
        permanent: true, // 308
      },
    ];
  },
};

export default nextConfig;
