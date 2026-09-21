import type { NextConfig } from "next";
const config: NextConfig = {
  // Isolate regression builds from an already running development server.
  distDir: process.env.TEACHWAY_BUILD_DIR || ".next",
};
export default config;
