import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  serverExternalPackages: ['pdf-parse'],
  async redirects() {
    return [
      // Legacy AI Team list → new Team dashboard
      { source: '/ai-team', destination: '/team', permanent: true },
      // Legacy Virtual Office → Team dashboard (deprecated)
      { source: '/virtual-office', destination: '/team', permanent: true },
    ];
  },
};

export default nextConfig;
