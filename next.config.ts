import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API Routes의 요청 크기 제한 설정
  api: {
    bodyParser: {
      sizeLimit: '10mb', // 전체 요청 크기 제한 (PDF 5MB + 이미지들 고려)
    },
  },
  // 실험적 기능으로 더 큰 파일 처리 허용
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

export default nextConfig;
