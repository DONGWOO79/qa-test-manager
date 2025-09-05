#!/bin/bash

# QA Test Manager 빠른 시작 스크립트
echo "🚀 QA Test Manager 서버를 시작합니다..."

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"

# 의존성 확인
if [ ! -d "node_modules" ]; then
    echo "📦 의존성을 설치하는 중..."
    npm install
fi

# 개발 서버 시작
echo "🔥 개발 서버를 시작합니다..."
echo "📍 접속 주소: http://localhost:3000"
echo "⏹️  서버를 중지하려면 Ctrl+C를 누르세요"
echo ""

npm run dev
