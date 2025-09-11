#!/bin/bash

echo "🔄 Spec Kit 하이브리드 구현 롤백 시작..."

# 1. Git 태그로 롤백
echo "📋 1단계: Git 태그로 안정 버전 복원"
git checkout pre-spec-kit

# 2. 핵심 파일 백업본으로 복원
echo "📋 2단계: 핵심 파일 백업본 복원"
if [ -f "src/app/api/ai/generate-testcases/route.ts.pre-spec-kit" ]; then
    cp src/app/api/ai/generate-testcases/route.ts.pre-spec-kit src/app/api/ai/generate-testcases/route.ts
    echo "✅ route.ts 복원 완료"
fi

if [ -f "src/components/ai/AIGenerationModal.tsx.pre-spec-kit" ]; then
    cp src/components/ai/AIGenerationModal.tsx.pre-spec-kit src/components/ai/AIGenerationModal.tsx
    echo "✅ AIGenerationModal.tsx 복원 완료"
fi

# 3. 의존성 재설치
echo "📋 3단계: 의존성 재설치"
npm install

# 4. 개발 서버 재시작 안내
echo "📋 4단계: 개발 서버 재시작 필요"
echo ""
echo "🎉 롤백 완료!"
echo ""
echo "📌 다음 명령어로 개발 서버를 재시작하세요:"
echo "   npm run dev"
echo ""
echo "📌 롤백된 상태:"
echo "   - 완전 동작하는 AI 테스트케이스 생성"
echo "   - PDF 파싱 + Vision AI + Ollama 통합"
echo "   - 타임아웃 해결 및 개수 개선 완료"
echo ""
