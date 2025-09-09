# QA 테스트 케이스 관리 시스템

## 프로젝트 개요

QA 테스트 케이스 관리 및 실행 결과 추적을 위한 웹 기반 시스템입니다. 20명 규모의 팀에서 사용할 수 있도록 설계되었으며, 스프레드시트 기반 관리의 한계를 극복하기 위해 개발되었습니다.

## 주요 기능

### 🔍 검색 및 필터링
- 실시간 검색 (제목, 설명, 카테고리)
- 고급 필터링 (상태, 우선순위, 프로젝트, 날짜 범위)
- 정렬 기능 (제목, 상태, 우선순위, 생성일)
- 페이지네이션 지원

### 📊 테스트 케이스 관리
- 테스트 케이스 CRUD 작업
- 카테고리별 분류
- 우선순위 설정 (High, Medium, Low)
- 상태 관리 (Pass, Fail, NA, Holding, Not Run)

### 🔄 테스트 실행 관리
- 테스트 실행 세션 생성
- 실행 결과 기록
- 통계 및 리포트 생성

### 📈 통계 및 리포트
- 프로젝트별 통계
- 컴포넌트별 분석
- Pass Rate, Cover Rate 계산

### 🤖 AI 기반 테스트케이스 생성
- **PDF 문서 분석**: 기획서, 요구사항 문서에서 자동 테스트케이스 생성
- **이미지 분석**: 다이어그램, 플로우차트, UI 목업 분석 지원
- **Ollama 통합**: 로컬 AI 모델을 활용한 무료 테스트케이스 생성
- **다국어 지원**: 한국어 기반 테스트케이스 생성 및 관리
- **스마트 매핑**: AI 생성 결과를 데이터베이스 스키마에 자동 매핑

### 📁 Import/Export
- Excel 파일 Import/Export
- CSV 형식 지원

### 👥 사용자 관리
- 사용자 인증 (로그인/회원가입)
- 역할 기반 접근 제어
- JWT 토큰 기반 인증

## 기술 스택

### Frontend
- **Next.js 14** - React 기반 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 스타일링
- **Heroicons** - 아이콘
- **React Context API** - 상태 관리

### Backend
- **Next.js API Routes** - 서버 API
- **SQLite** - 데이터베이스 (개발용)
- **better-sqlite3** - SQLite 드라이버

### 인증
- **JWT** - 토큰 기반 인증
- **bcryptjs** - 비밀번호 해싱

### 파일 처리
- **xlsx** - Excel 파일 처리
- **multer** - 파일 업로드
- **pdf-parse** - PDF 텍스트 추출
- **pdfjs-dist** - PDF 파싱 라이브러리

### AI 및 머신러닝
- **Ollama** - 로컬 AI 모델 서버 (gpt-oss:20b, llava:7b)
- **Vision AI** - 이미지 분석 및 다이어그램 해석
- **자연어 처리** - 한국어 문서 분석 및 테스트케이스 생성

## 설치 및 실행

### 필수 요구사항
- Node.js 18.0+
- npm 또는 yarn
- **Ollama** (AI 테스트케이스 생성 기능 사용 시)

### 설치
```bash
# 저장소 클론
git clone https://github.com/DONGWOO79/qa-test-manager.git
cd qa-test-manager

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### Ollama 설치 및 설정 (AI 기능 사용 시)

#### 1. Ollama 설치
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# https://ollama.ai/download 에서 설치 프로그램 다운로드
```

#### 2. AI 모델 다운로드
```bash
# 텍스트 생성 모델 (테스트케이스 생성용)
ollama pull gpt-oss:20b

# 이미지 분석 모델 (다이어그램 분석용)
ollama pull llava:7b
```

#### 3. Ollama 서버 실행
```bash
# Ollama 서버 시작 (기본 포트: 11434)
ollama serve
```

#### 4. 모델 동작 확인
```bash
# 텍스트 모델 테스트
ollama run gpt-oss:20b "안녕하세요"

# 이미지 모델 테스트
ollama run llava:7b "이 이미지를 설명해주세요" --image path/to/image.png
```

> **참고**: AI 기능을 사용하지 않으려면 Ollama 설치를 건너뛰어도 됩니다. 시스템의 다른 모든 기능은 정상적으로 작동합니다.

### 데이터베이스 초기화
```bash
# 데이터베이스 초기화
curl -X POST http://localhost:3000/api/init-db

# 샘플 데이터 추가
curl -X POST http://localhost:3000/api/populate-db
```

### 빌드 및 배포
```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 사용자 등록
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃

### 테스트 케이스
- `GET /api/test-cases` - 테스트 케이스 목록
- `POST /api/test-cases` - 테스트 케이스 생성
- `GET /api/test-cases/search` - 검색 및 필터링
- `GET /api/test-cases/[id]` - 특정 테스트 케이스 조회
- `PUT /api/test-cases/[id]` - 테스트 케이스 수정
- `DELETE /api/test-cases/[id]` - 테스트 케이스 삭제

### 프로젝트
- `GET /api/projects` - 프로젝트 목록
- `POST /api/projects` - 프로젝트 생성

### 통계
- `GET /api/statistics` - 통계 데이터

### Import/Export
- `POST /api/import-export/import-excel` - Excel 파일 Import
- `GET /api/import-export/export-excel` - Excel 파일 Export

### AI 테스트케이스 생성
- `POST /api/ai/generate-testcases` - PDF/이미지 기반 AI 테스트케이스 생성

## AI 테스트케이스 생성 사용법

### 기본 사용법
1. **프로젝트 생성**: 먼저 테스트케이스를 생성할 프로젝트를 만듭니다.
2. **문서 업로드**: PDF 기획서나 요구사항 문서를 업로드합니다.
3. **이미지 추가** (선택사항): 다이어그램, 플로우차트, UI 목업 등을 함께 업로드합니다.
4. **AI 생성**: "AI로 테스트케이스 생성" 버튼을 클릭합니다.
5. **결과 확인**: 생성된 테스트케이스를 검토하고 필요시 수정합니다.

### 지원되는 파일 형식
- **문서**: PDF (.pdf)
- **이미지**: PNG, JPEG, JPG, GIF, WebP, BMP
- **최대 파일 크기**: 5MB

### AI 생성 특징
- **자동 카테고리 분류**: 기능테스트, 성능테스트, 보안테스트, UI테스트, 통합테스트
- **우선순위 설정**: High, Medium, Low 자동 할당
- **구조화된 정보**: 사전 조건, 테스트 단계, 예상 결과 포함
- **한국어 최적화**: 한국어 문서에 특화된 분석 및 생성

### 팁
- 📄 **상세한 문서**: 더 구체적인 기획서일수록 정확한 테스트케이스 생성
- 🖼️ **다이어그램 활용**: 플로우차트나 화면 설계서를 함께 업로드하면 더 포괄적인 케이스 생성
- 🔍 **검토 필수**: AI 생성 결과를 반드시 검토하고 프로젝트에 맞게 조정

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 엔드포인트
│   ├── login/             # 로그인 페이지
│   ├── register/          # 회원가입 페이지
│   ├── layout.tsx         # 루트 레이아웃
│   └── page.tsx           # 메인 페이지
├── components/            # React 컴포넌트
│   ├── auth/              # 인증 관련 컴포넌트
│   ├── ai/                # AI 테스트케이스 생성 컴포넌트
│   ├── search/            # 검색 관련 컴포넌트
│   ├── test-cases/        # 테스트 케이스 컴포넌트
│   ├── test-runs/         # 테스트 실행 컴포넌트
│   ├── statistics/        # 통계 컴포넌트
│   └── import-export/     # Import/Export 컴포넌트
├── lib/                   # 유틸리티 라이브러리
│   ├── db/                # 데이터베이스 관련
│   ├── auth.ts            # 인증 유틸리티
│   ├── middleware/        # 미들웨어
│   └── search/            # 검색 유틸리티
├── types/                 # TypeScript 타입 정의
└── context/               # React Context
```

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 연락처

프로젝트 링크: [https://github.com/DONGWOO79/qa-test-manager](https://github.com/DONGWOO79/qa-test-manager)

## 개발 로그

### 완료된 작업
- ✅ 프로젝트 초기 설정 (Next.js 14, TypeScript, Tailwind CSS)
- ✅ 데이터베이스 스키마 설계 및 구현
- ✅ 사용자 인증 시스템 (JWT, bcryptjs)
- ✅ 테스트 케이스 CRUD API
- ✅ 검색 및 고급 필터링 기능
- ✅ Import/Export 기능 (Excel)
- ✅ 통계 및 리포트 기능
- ✅ 반응형 UI 구현
- ✅ **AI 기반 테스트케이스 생성 시스템**
  - PDF 문서 파싱 및 텍스트 추출
  - Ollama 통합 (gpt-oss:20b, llava:7b)
  - 이미지 분석 및 다이어그램 해석
  - 한국어 테스트케이스 자동 생성
  - 스마트 필드 매핑 및 데이터베이스 저장

### 진행 중인 작업
- 🔄 배포 및 CI/CD 파이프라인 설정
- 🔄 AI 모델 성능 최적화

### 예정된 작업
- 📋 알림 시스템
- 📋 댓글 및 협업 기능
- 📋 API 문서화
- 📋 클라우드 AI 모델 지원 (OpenAI, Claude 등)
