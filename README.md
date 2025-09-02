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

## 설치 및 실행

### 필수 요구사항
- Node.js 18.0+
- npm 또는 yarn

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

### 진행 중인 작업
- 🔄 배포 및 CI/CD 파이프라인 설정

### 예정된 작업
- 📋 알림 시스템
- 📋 댓글 및 협업 기능
- 📋 API 문서화
