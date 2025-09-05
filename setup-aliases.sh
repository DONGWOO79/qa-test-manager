#!/bin/bash

# QA Test Manager 별칭 설정 스크립트
echo "🔧 QA Test Manager 별칭을 설정합니다..."

PROJECT_DIR="/Users/kakaovx/qa-test-manager"
SHELL_CONFIG=""

# 사용 중인 셸 확인
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_CONFIG="$HOME/.zshrc"
    echo "📝 zsh 설정 파일에 별칭을 추가합니다: $SHELL_CONFIG"
elif [[ "$SHELL" == *"bash"* ]]; then
    SHELL_CONFIG="$HOME/.bashrc"
    echo "📝 bash 설정 파일에 별칭을 추가합니다: $SHELL_CONFIG"
else
    echo "❌ 지원하지 않는 셸입니다. 수동으로 별칭을 설정해주세요."
    exit 1
fi

# 별칭 추가
echo "" >> "$SHELL_CONFIG"
echo "# QA Test Manager 별칭" >> "$SHELL_CONFIG"
echo "alias qastart='cd $PROJECT_DIR && npm run dev'" >> "$SHELL_CONFIG"
echo "alias qas='cd $PROJECT_DIR && npm run s'" >> "$SHELL_CONFIG"
echo "alias qacd='cd $PROJECT_DIR'" >> "$SHELL_CONFIG"
echo "alias qascript='cd $PROJECT_DIR && ./start-server.sh'" >> "$SHELL_CONFIG"

echo "✅ 별칭이 설정되었습니다!"
echo ""
echo "사용 가능한 별칭:"
echo "  qastart  - QA Test Manager 서버 시작"
echo "  qas      - QA Test Manager 서버 시작 (단축형)"
echo "  qacd     - QA Test Manager 디렉토리로 이동"
echo "  qascript - 시작 스크립트 실행"
echo ""
echo "🔄 변경사항을 적용하려면 다음 명령어를 실행하세요:"
echo "source $SHELL_CONFIG"
echo ""
echo "또는 새 터미널 창을 열어주세요."
