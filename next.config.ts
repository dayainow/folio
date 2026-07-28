import type { NextConfig } from "next";

/**
 * Folio Next.js config
 * - standalone: Docker 이미지용 최소 산출물
 * - 서버 전용 시크릿(JIRA_*, SLACK_*, GITHUB_*, DISCORD_*)은
 *   process.env 로 런타임에만 읽고, NEXT_PUBLIC_ 로 노출하지 않는다.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
