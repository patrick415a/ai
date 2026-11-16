import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/group/two/3",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
