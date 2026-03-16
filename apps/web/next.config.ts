import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rampup/ai-engine", "@rampup/integrations", "@rampup/supabase"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
