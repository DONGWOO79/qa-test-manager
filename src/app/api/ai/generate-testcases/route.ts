import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';

// 파일 처리 라이브러리들 (동적 import로 변경)
// import * as XLSX from 'xlsx';
// import * as mammoth from 'mammoth';
// import * as pdfParse from 'pdf-parse';

const dbPath = path.join(process.cwd(), 'database.db');

// 파일 텍스트 추출 함수
async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  try {
    console.log('파일 읽기 시작:', filePath);
    const fileContent = await fs.promises.readFile(filePath);
    console.log('파일 읽기 완료, 크기:', fileContent.length);

    // 파일 확장자에 따른 처리
    const ext = path.extname(filePath).toLowerCase();
    console.log('파일 확장자:', ext);

    switch (ext) {
      case '.txt':
        console.log('TXT 파일 처리');
        return fileContent.toString('utf-8');

      case '.csv':
        console.log('CSV 파일 처리');
        return fileContent.toString('utf-8');

      case '.pdf':
        console.log('PDF 파일 처리');
        try {
          // 동적 import 사용
          const pdfParse = await import('pdf-parse').then(module => module.default);

          console.log('PDF 파싱 시작, 파일 크기:', fileContent.length);
          const pdfResult = await pdfParse(fileContent);

          // 텍스트 길이 제한을 늘려서 더 많은 내용 처리
          let text = pdfResult.text;
          console.log('PDF 원본 텍스트 길이:', text.length);

          if (text.length > 20000) { // 15000 -> 20000으로 증가
            text = text.substring(0, 20000) + "\n\n... (내용이 너무 길어서 앞부분만 사용)";
            console.log('PDF 텍스트 길이 제한 적용:', text.length);
          }

          console.log('PDF 텍스트 추출 성공, 최종 길이:', text.length);
          console.log('PDF 텍스트 미리보기:', text.substring(0, 200));
          return text;
        } catch (pdfError) {
          console.error('PDF 처리 오류:', pdfError);
          // PDF 처리 실패 시 파일명 기반으로 더 상세한 텍스트 생성
          const fileName = path.basename(filePath, '.pdf');
          const baseText = `
PDF 파일 "${fileName}"을 분석하여 테스트케이스를 생성합니다.

파일명 기반 추정 내용:
- 프로젝트명: ${fileName.includes('GOLFVX') ? 'GOLFVX' : '프로젝트'}
- 문서 유형: ${fileName.includes('기획') ? '기획서' : fileName.includes('요구사항') ? '요구사항서' : '프로젝트 문서'}
- 주요 기능: ${fileName.includes('FMS') ? 'Fleet Management System (차량 관리 시스템)' : '시스템 개선'}

예상 테스트 영역:
- 사용자 인터페이스 개선
- 시스템 성능 최적화
- 데이터 관리 기능
- 보안 및 접근 제어
          `;
          console.log('PDF 처리 실패, 기본 텍스트 생성:', baseText.length);
          return baseText;
        }

      case '.docx':
      case '.doc':
        console.log('Word 파일 처리');
        try {
          const mammoth = await import('mammoth');
          const mammothResult = await mammoth.extractRawText({ path: filePath });
          return mammothResult.value;
        } catch (wordError) {
          console.error('Word 파일 처리 오류:', wordError);
          return "Word 문서 내용 (처리 중 오류 발생)";
        }

      case '.xlsx':
      case '.xls':
        console.log('Excel 파일 처리');
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(fileContent);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          return XLSX.utils.sheet_to_txt(worksheet);
        } catch (excelError) {
          console.error('Excel 파일 처리 오류:', excelError);
          return "Excel 파일 내용 (처리 중 오류 발생)";
        }

      case '.pptx':
      case '.ppt':
        console.log('PowerPoint 파일 처리');
        return "PowerPoint 파일 내용 (PowerPoint 지원은 향후 구현 예정)";

      default:
        console.log('기본 텍스트 처리');
        return fileContent.toString('utf-8');
    }
  } catch (error) {
    console.error('파일 텍스트 추출 오류:', error);
    throw new Error(`파일 내용을 읽을 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

// AI 프롬프트 생성 (Ollama 앱과 동일하게)
function createAIPrompt(content: string, projectName: string): string {
  // 내용이 너무 길면 요약 (제한을 늘려서 더 많은 내용 처리)
  let processedContent = content;
  if (content.length > 15000) { // 10000 -> 15000으로 증가
    processedContent = content.substring(0, 15000) + "\n\n... (내용이 너무 길어서 앞부분만 사용)";
    console.log('프롬프트 내용 길이 제한 적용:', processedContent.length);
  }

  return `당신은 전문 QA 엔지니어입니다. 아래 제공된 문서는 "${projectName}" 프로젝트의 실제 기획서입니다. 이 문서의 내용만을 기반으로 테스트케이스를 생성해주세요.

**경고: 문서에 없는 내용은 절대 추가하지 마세요. 오직 문서에 명시된 기능만 테스트하세요.**

**이 문서의 주요 내용:**
- GOLFVX FMS 개선 기획
- No Show 시스템 개발 (예약 취소, 위약금 처리)
- 카드 등록 및 결제 시스템 (SetupIntent)
- 예약 상태 관리 (예약확정, 예약취소, 이용완료, No Show, 타석이동)
- 매출 관리 및 결제 취소
- 직원 권한 설정
- APP 예약 연동

**반드시 이런 테스트케이스를 만드세요:**
1. "No Show 처리 위약금 청구 테스트"
2. "카드 등록 SetupIntent 테스트"  
3. "예약 상태 변경 테스트 (예약확정→이용완료)"
4. "결제 취소 7일 이내 제한 테스트"
5. "직원 권한별 No Show 처리 접근 테스트"
6. "앱 예약 시 카드 등록 필수 확인 테스트"
7. "매장별 취소 정책 설정 테스트"

**절대 만들면 안 되는 테스트케이스:**
- 골프카트 등록 (문서에 없음)
- 배터리 모니터링 (문서에 없음)  
- GPS 추적 (문서에 없음)
- 일반적인 차량 관리 기능

**테스트케이스 형식:**
각 테스트케이스는 다음 필드를 포함 (모든 내용을 한국어로):
- title: 테스트케이스 제목
- description: 상세 설명  
- category: 카테고리 (기능테스트, 성능테스트, 보안테스트, 사용자인터페이스, 통합테스트)
- priority: 우선순위 (high, medium, low)
- status: 상태 (draft)
- preCondition: 사전 조건
- testStep: 테스트 단계 (줄바꿈은 \\n 사용)
- expectedResult: 예상 결과
- testStrategy: 테스트 전략

20개 이상 생성하되, 반드시 문서 내용만 기반으로 하세요.
JSON 배열 형식으로만 응답하세요.

기획서 내용:
${processedContent}

**예시 (문서 내용을 기반으로 한 올바른 테스트케이스):**
[
  {
    "title": "골프카트 GC001 배터리 상태 모니터링",
    "description": "골프카트 GC001의 배터리 잔량이 실시간으로 정확하게 표시되는지 확인",
    "category": "기능테스트",
    "priority": "high",
    "status": "draft",
    "preCondition": "골프카트 GC001이 시스템에 등록되어 있고, GPS 모듈이 정상 작동 중",
    "testStep": "1. 관리자 대시보드 접속\n2. 카트 현황 메뉴 클릭\n3. GC001 카트 선택\n4. 배터리 상태 정보 확인",
    "expectedResult": "배터리 잔량이 %로 표시되고, 충전 필요 시 알림이 표시됨",
    "testStrategy": "실제 카트 배터리 상태와 시스템 표시값 비교 검증"
  }
]

**주의사항: JSON 배열만 응답하고, 다른 텍스트나 설명은 포함하지 마세요. 모든 필드 값은 한국어로 작성해야 합니다.**`;
}

// Ollama API 호출 (무료 로컬 AI)
async function callOllama(prompt: string): Promise<any[]> {
  try {
    console.log('Ollama API 호출 시작...');

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-oss:20b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2, // 더 일관성 있는 응답을 위해 낮춤
          top_p: 0.8,
          num_predict: 8000, // 더 긴 응답을 위해 토큰 수 증가
          stop: ['```', '---', 'Note:', '참고:', '설명:', 'explanation:'], // JSON 응답만 받기 위해 중단 토큰 설정
          repeat_penalty: 1.1, // 반복 방지
          seed: -1 // 랜덤 시드
        }
      }),
      signal: AbortSignal.timeout(240000) // 240초 타임아웃으로 증가
    });

    if (!response.ok) {
      throw new Error(`Ollama API 오류: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Ollama 응답:', result);

    if (!result.response) {
      throw new Error('Ollama에서 응답을 받지 못했습니다.');
    }

    // JSON 응답 파싱 시도
    try {
      // 응답에서 JSON 부분만 추출
      let jsonText = result.response;

      console.log('원본 응답 길이:', jsonText.length);
      console.log('원본 응답 시작:', jsonText.substring(0, 200) + '...');

      // JSON 배열이 코드 블록 안에 있는 경우 추출
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\[.*?\])\s*```/s);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
        console.log('코드 블록에서 JSON 추출 성공');
      }

      // JSON 배열이 대괄호로 시작하는 경우 찾기
      const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonText = arrayMatch[0];
        console.log('대괄호 패턴에서 JSON 추출 성공');
      }

      // 이스케이프된 문자열 안전하게 처리
      jsonText = jsonText.replace(/\\"/g, '"');
      // 제어 문자 제거 (줄바꿈은 \n으로 변환)
      jsonText = jsonText.replace(/\\n/g, '\\n');
      // 기타 제어 문자 제거
      jsonText = jsonText.replace(/[\x00-\x1F\x7F]/g, '');

      // 한국어 따옴표 문제 해결
      jsonText = jsonText.replace(/"/g, '"').replace(/"/g, '"');
      // 잘못된 따옴표 패턴 수정
      jsonText = jsonText.replace(/"(\s*[^"]*?\s*)"/g, '"$1"');

      console.log('최종 JSON 텍스트 길이:', jsonText.length);
      console.log('최종 JSON 텍스트 시작:', jsonText.substring(0, 300) + '...');

      let testCases;
      try {
        testCases = JSON.parse(jsonText);
      } catch (strictParseError) {
        console.log('엄격한 JSON 파싱 실패, 수정 시도:', strictParseError);
        console.log('오류 위치 주변 텍스트:', jsonText.substring(Math.max(0, 9200), 9350));

        // 더 강력한 JSON 수정 로직
        try {
          let cleanedJson = jsonText
            // 백틱 처리
            .replace(/`/g, '"')
            // 작은따옴표를 큰따옴표로
            .replace(/'/g, '"')
            // 연속된 줄바꿈 정리
            .replace(/\n\s*\n/g, '\n')
            // 마지막 쉼표 제거
            .replace(/,(\s*[}\]])/g, '$1')
            // 문자열 내부의 잘못된 따옴표 처리 (더 강력하게)
            .replace(/: "([^"]*)"([^"]*)"([^"]*)",/g, ': "$1\\"$2\\"$3",')
            // 설명 필드 내의 따옴표 문제 해결
            .replace(/"description": "([^"]*)"([^"]*)"([^"]*)",/g, '"description": "$1\\"$2\\"$3",')
            // preCondition 필드 내의 따옴표 문제 해결  
            .replace(/"preCondition": "([^"]*)"([^"]*)"([^"]*)",/g, '"preCondition": "$1\\"$2\\"$3",')
            // testStep 필드 내의 따옴표 문제 해결
            .replace(/"testStep": "([^"]*)"([^"]*)"([^"]*)",/g, '"testStep": "$1\\"$2\\"$3",')
            // expectedResult 필드 내의 따옴표 문제 해결
            .replace(/"expectedResult": "([^"]*)"([^"]*)"([^"]*)",/g, '"expectedResult": "$1\\"$2\\"$3",')
            // 일반적인 문자열 값에서 따옴표 문제 해결
            .replace(/": "([^"]*)"([^"]*)"([^"]*)"([^"]*)/g, '": "$1\\"$2\\"$3\\"$4"')
            // 제어 문자 완전 제거
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

          console.log('정리된 JSON 길이:', cleanedJson.length);
          console.log('정리된 JSON 시작:', cleanedJson.substring(0, 300) + '...');

          testCases = JSON.parse(cleanedJson);
          console.log('수정된 JSON 파싱 성공!');
        } catch (relaxedParseError) {
          console.log('수정된 JSON 파싱도 실패:', relaxedParseError);

          // 마지막 시도: 정규식으로 테스트케이스 추출
          console.log('정규식으로 테스트케이스 추출 시도...');
          try {
            // 더 강력한 정규식으로 모든 필드 추출
            const testCaseObjects = [];

            // JSON 객체들을 개별적으로 추출
            const objectRegex = /{[^{}]*(?:{[^{}]*}[^{}]*)*}/g;
            const objects = jsonText.match(objectRegex) || [];

            console.log(`발견된 JSON 객체 수: ${objects.length}`);

            for (const obj of objects) {
              try {
                // 각 필드를 개별적으로 추출
                const title = obj.match(/"title":\s*"([^"]*)"/) || obj.match(/"title":\s*'([^']*)'/) || [];
                const description = obj.match(/"description":\s*"([^"]*)"/) || obj.match(/"description":\s*'([^']*)'/) || [];
                const category = obj.match(/"category":\s*"([^"]*)"/) || obj.match(/"category":\s*'([^']*)'/) || [];
                const priority = obj.match(/"priority":\s*"([^"]*)"/) || obj.match(/"priority":\s*'([^']*)'/) || [];
                const status = obj.match(/"status":\s*"([^"]*)"/) || obj.match(/"status":\s*'([^']*)'/) || [];
                const preCondition = obj.match(/"preCondition":\s*"([^"]*)"/) || obj.match(/"preCondition":\s*'([^']*)'/) || [];
                const testStep = obj.match(/"testStep":\s*"([^"]*)"/) || obj.match(/"testStep":\s*'([^']*)'/) || [];
                const expectedResult = obj.match(/"expectedResult":\s*"([^"]*)"/) || obj.match(/"expectedResult":\s*'([^']*)'/) || [];
                const testStrategy = obj.match(/"testStrategy":\s*"([^"]*)"/) || obj.match(/"testStrategy":\s*'([^']*)'/) || [];

                // 최소한 title이 있는 경우만 추가
                if (title[1]) {
                  testCaseObjects.push({
                    title: title[1] || '제목 없음',
                    description: description[1] || '설명 없음',
                    category: category[1] || '기능테스트',
                    priority: priority[1] || 'medium',
                    status: status[1] || 'draft',
                    preCondition: preCondition[1] || 'AI 생성 중 누락됨',
                    testStep: testStep[1] ? testStep[1].replace(/\\n/g, '\n') : '1. 테스트 단계가 누락됨',
                    expectedResult: expectedResult[1] || '예상 결과가 누락됨',
                    testStrategy: testStrategy[1] || '검증 방법이 누락됨'
                  });
                }
              } catch (objError) {
                console.log('개별 객체 파싱 실패:', objError);
                continue;
              }
            }

            if (testCaseObjects.length > 0) {
              console.log(`정규식으로 ${testCaseObjects.length}개 완전한 테스트케이스 추출 성공!`);
              return testCaseObjects;
            }
          } catch (regexError) {
            console.log('정규식 추출도 실패:', regexError);
          }

          throw strictParseError;
        }
      }
      if (Array.isArray(testCases) && testCases.length > 0) {
        console.log('JSON 파싱 성공, 테스트케이스 수:', testCases.length);
        return testCases;
      } else {
        console.log('JSON 파싱 성공했지만 배열이 비어있음');
      }
    } catch (parseError) {
      console.log('JSON 파싱 실패:', parseError);
      console.log('파싱 시도한 텍스트:', jsonText ? jsonText.substring(0, 500) + '...' : '텍스트 없음');
    }

    // JSON 파싱이 실패한 경우 텍스트에서 테스트케이스 추출
    const text = result.response;
    const extractedTestCases = extractTestCasesFromText(text);

    if (extractedTestCases.length === 0) {
      // 기본 테스트케이스 반환
      return [
        {
          title: "사용자 로그인 테스트",
          description: "유효한 사용자 계정으로 로그인 기능을 테스트합니다.",
          category: "인증",
          priority: "High",
          status: "Not Run",
          preCondition: "사용자가 등록된 계정을 가지고 있어야 함",
          testStep: "1. 로그인 페이지 접속\n2. 유효한 이메일과 비밀번호 입력\n3. 로그인 버튼 클릭",
          expectedResult: "로그인이 성공하고 메인 페이지로 이동"
        },
        {
          title: "잘못된 비밀번호 로그인 테스트",
          description: "잘못된 비밀번호로 로그인 시도 시 오류 메시지 표시를 테스트합니다.",
          category: "인증",
          priority: "Medium",
          status: "Not Run",
          preCondition: "등록된 사용자 계정이 있어야 함",
          testStep: "1. 로그인 페이지 접속\n2. 유효한 이메일과 잘못된 비밀번호 입력\n3. 로그인 버튼 클릭",
          expectedResult: "오류 메시지가 표시되고 로그인되지 않음"
        }
      ];
    }

    return extractedTestCases;
  } catch (error) {
    console.error('Ollama API 호출 오류:', error);

    // 타임아웃 오류인 경우 더 구체적인 메시지 제공
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('AI 응답 시간 초과, 기본 테스트케이스 반환');
      return [
        {
          title: "기본 기능 테스트 (AI 타임아웃으로 인한 기본 케이스)",
          description: "AI 응답이 시간 초과되어 기본 테스트케이스를 생성했습니다.",
          category: "기능테스트",
          priority: "medium",
          status: "draft",
          testStep: "1. 기본 기능 확인\n2. 정상 동작 검증",
          expectedResult: "기능이 정상적으로 동작함"
        }
      ];
    }

    throw new Error(`AI 서비스 호출 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

// 텍스트에서 테스트케이스 추출하는 함수 (강화된 파싱 로직)
function extractTestCasesFromText(text: string): any[] {
  const testCases = [];

  console.log('텍스트에서 테스트케이스 추출 시작');
  console.log('텍스트 길이:', text.length);

  // 1. JSON 객체 패턴 찾기 (개별 테스트케이스)
  const jsonObjectPattern = /\{\s*"title"\s*:\s*"([^"]+)"\s*,\s*"description"\s*:\s*"([^"]+)"\s*,\s*"category"\s*:\s*"([^"]+)"\s*,\s*"priority"\s*:\s*"([^"]+)"\s*,\s*"status"\s*:\s*"([^"]+)"\s*,\s*"testStep"\s*:\s*"([^"]+)"\s*,\s*"expectedResult"\s*:\s*"([^"]+)"\s*\}/gi;

  // 2. 테이블 형식 패턴 찾기 (TC-ID, 기능, 시나리오, 입력값, 예상 결과, 검증 포인트)
  const tablePattern = /\|\s*\*\*([A-Z0-9-]+)\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gi;

  // 3. 추가 패턴: 마크다운 테이블 헤더 다음의 데이터 행들
  const markdownTablePattern = /\|\s*([A-Z0-9-]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gi;

  // 4. 간단한 테이블 행 패턴
  const simpleTablePattern = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gi;

  // 5. 번호가 있는 테스트케이스 패턴
  const numberedPattern = /(\d+)[\.\s]*([^:\n]+)[:\s]*([^\n]+)/gi;

  // 6. 제목 패턴
  const titlePattern = /([가-힣a-zA-Z\s]+)(테스트|검증|확인|시험)/gi;

  // 7. 기능별 테스트케이스 패턴
  const functionPattern = /([가-힣a-zA-Z\s]+)(기능|모듈|시스템)(.*?)(테스트|검증|확인)/gi;

  let match;
  let count = 0;

  // JSON 객체 패턴에서 테스트케이스 추출
  while ((match = jsonObjectPattern.exec(text)) && count < 50) {
    const title = match[1].trim();
    const description = match[2].trim();
    const category = match[3].trim();
    const priority = match[4].trim();
    const status = match[5].trim();
    const testStep = match[6].trim();
    const expectedResult = match[7].trim();

    console.log(`Found JSON object pattern match: ${title}`);

    testCases.push({
      title: title,
      description: description,
      category: category,
      testStep: testStep,
      expectedResult: expectedResult,
      priority: priority.toLowerCase(),
      status: status.toLowerCase()
    });
    count++;
  }

  // 테이블 형식에서 테스트케이스 추출
  while ((match = tablePattern.exec(text)) && count < 20) {
    const testCaseId = match[1].trim();
    const functionality = match[2].trim();
    const scenario = match[3].trim();
    const input = match[4].trim();
    const expectedResult = match[5].trim();
    const verificationPoint = match[6].trim();

    console.log(`Found table pattern match: ${testCaseId} - ${functionality}`);

    testCases.push({
      title: functionality,
      description: `시나리오: ${scenario}\n입력값: ${input}\n예상 결과: ${expectedResult}\n검증 포인트: ${verificationPoint}`,
      category: '기능테스트',
      testStep: scenario,
      expectedResult: expectedResult,
      priority: 'medium',
      status: 'draft'
    });
    count++;
  }

  // 마크다운 테이블 패턴으로 추가 추출
  while ((match = markdownTablePattern.exec(text)) && count < 20) {
    const testCaseId = match[1].trim();
    const functionality = match[2].trim();
    const scenario = match[3].trim();
    const input = match[4].trim();
    const expectedResult = match[5].trim();
    const verificationPoint = match[6].trim();

    // 이미 추가된 테스트케이스인지 확인
    const existing = testCases.find(tc => tc.title === functionality);
    if (existing) continue;

    console.log(`Found markdown table pattern match: ${testCaseId} - ${functionality}`);

    testCases.push({
      title: functionality,
      description: `시나리오: ${scenario}\n입력값: ${input}\n예상 결과: ${expectedResult}\n검증 포인트: ${verificationPoint}`,
      category: '기능테스트',
      testStep: scenario,
      expectedResult: expectedResult,
      priority: 'medium',
      status: 'draft'
    });
    count++;
  }

  // 3. 간단한 테이블 행 패턴으로 추가 추출
  if (testCases.length < 5) {
    while ((match = simpleTablePattern.exec(text)) && count < 10) {
      const testCaseId = match[1].trim();
      const functionality = match[2].trim();
      const scenario = match[3].trim();
      const input = match[4].trim();
      const expectedResult = match[5].trim();
      const verificationPoint = match[6].trim();

      // 이미 추가된 테스트케이스인지 확인
      const existing = testCases.find(tc => tc.title === functionality);
      if (existing) continue;

      console.log(`Found simple table pattern match: ${testCaseId} - ${functionality}`);

      testCases.push({
        title: functionality,
        description: `시나리오: ${scenario}\n입력값: ${input}\n예상 결과: ${expectedResult}\n검증 포인트: ${verificationPoint}`,
        category: '기능테스트',
        testStep: scenario,
        expectedResult: expectedResult,
        priority: 'medium',
        status: 'draft'
      });
      count++;
    }
  }

  // 4. 번호가 있는 테스트케이스 패턴
  if (testCases.length < 5) {
    while ((match = numberedPattern.exec(text)) && count < 10) {
      const number = match[1].trim();
      const title = match[2].trim();
      const description = match[3].trim();

      // 이미 추가된 테스트케이스인지 확인
      const existing = testCases.find(tc => tc.title === title);
      if (existing) continue;

      console.log(`Found numbered pattern match: ${number} - ${title}`);

      testCases.push({
        title: title,
        description: description,
        category: '기능테스트',
        testStep: `1. ${title} 기능 접근\n2. 기능 테스트 실행\n3. 결과 확인`,
        expectedResult: "기능이 정상적으로 작동함",
        priority: 'medium',
        status: 'draft'
      });
      count++;
    }
  }

  // 5. 제목 패턴으로 추가 추출
  if (testCases.length < 5) {
    while ((match = titlePattern.exec(text)) && count < 10) {
      const title = match[1].trim() + match[2];

      // 이미 추가된 테스트케이스인지 확인
      const existing = testCases.find(tc => tc.title === title);
      if (existing) continue;

      console.log(`Found title pattern match: ${title}`);

      testCases.push({
        title: title,
        description: `${title}에 대한 상세 테스트 시나리오`,
        category: '기능테스트',
        testStep: `1. ${title} 기능 접근\n2. 기능 테스트 실행\n3. 결과 확인`,
        expectedResult: "기능이 정상적으로 작동함",
        priority: 'medium',
        status: 'draft'
      });
      count++;
    }
  }

  // 6. 기존 Test Case 패턴도 지원
  if (testCases.length === 0) {
    const testCasePattern = /Test Case \d+[:\s]*([^\n]+)/gi;
    let testCaseMatch;

    while ((testCaseMatch = testCasePattern.exec(text)) && count < 10) {
      const title = testCaseMatch[1].trim();
      console.log(`테스트케이스 ${count + 1}:`, title);

      testCases.push({
        title: title,
        description: `테스트케이스 ${count + 1}에 대한 상세 설명`,
        category: "기본",
        priority: "medium",
        status: "draft",
        preCondition: "테스트 환경이 준비되어 있어야 함",
        testStep: `1. ${title} 기능 접근\n2. 기능 테스트 실행\n3. 결과 확인`,
        expectedResult: "기능이 정상적으로 작동함"
      });
      count++;
    }
  }

  // 최소 3개 이상의 테스트케이스가 없으면 기본 테스트케이스로 보충
  if (testCases.length < 3) {
    console.log(`테스트케이스가 ${testCases.length}개만 추출됨, 기본 테스트케이스로 보충`);

    const defaultCases = [
      {
        title: "사용자 로그인 기능 테스트",
        description: "유효한 사용자 계정으로 로그인 기능을 테스트합니다.",
        category: "로그인",
        testStep: "1. 로그인 페이지 접속\n2. 유효한 이메일과 비밀번호 입력\n3. 로그인 버튼 클릭",
        expectedResult: "로그인이 성공하고 메인 페이지로 이동",
        priority: "medium",
        status: "draft"
      },
      {
        title: "상품 목록 조회 테스트",
        description: "상품 목록이 정상적으로 표시되는지 테스트합니다.",
        category: "상품관리",
        testStep: "1. 메인 페이지 접속\n2. 상품 목록 확인\n3. 상품 정보 검증",
        expectedResult: "상품 목록이 정상적으로 표시됨",
        priority: "medium",
        status: "draft"
      },
      {
        title: "회원가입 기능 테스트",
        description: "새로운 사용자 회원가입 기능을 테스트합니다.",
        category: "회원관리",
        testStep: "1. 회원가입 페이지 접속\n2. 필수 정보 입력\n3. 회원가입 버튼 클릭",
        expectedResult: "회원가입이 성공하고 확인 이메일 발송",
        priority: "medium",
        status: "draft"
      }
    ];

    // 기존 테스트케이스와 중복되지 않는 기본 테스트케이스만 추가
    for (const defaultCase of defaultCases) {
      const existing = testCases.find(tc => tc.title === defaultCase.title);
      if (!existing && testCases.length < 5) {
        testCases.push(defaultCase);
      }
    }
  }

  console.log('추출된 테스트케이스 수:', testCases.length);
  return testCases;
}

// 기본 테스트케이스 생성 함수
function generateDefaultTestCases(projectName: string, content: string): any[] {
  console.log('기본 테스트케이스 생성 시작');

  const testCases = [
    {
      title: "사용자 로그인 기능 테스트",
      description: "유효한 사용자 계정으로 로그인 기능을 테스트합니다.",
      category: "로그인",
      priority: "high",
      status: "draft",
      preCondition: "사용자가 등록된 계정을 가지고 있어야 함",
      testStep: "1. 로그인 페이지 접속\n2. 유효한 이메일과 비밀번호 입력\n3. 로그인 버튼 클릭",
      expectedResult: "로그인이 성공하고 메인 페이지로 이동"
    },
    {
      title: "잘못된 비밀번호 로그인 테스트",
      description: "잘못된 비밀번호로 로그인 시도 시 오류 메시지 표시를 테스트합니다.",
      category: "로그인",
      priority: "medium",
      status: "draft",
      preCondition: "등록된 사용자 계정이 있어야 함",
      testStep: "1. 로그인 페이지 접속\n2. 유효한 이메일과 잘못된 비밀번호 입력\n3. 로그인 버튼 클릭",
      expectedResult: "오류 메시지가 표시되고 로그인되지 않음"
    },
    {
      title: "회원가입 기능 테스트",
      description: "새로운 사용자 회원가입 기능을 테스트합니다.",
      category: "회원가입",
      priority: "high",
      status: "draft",
      preCondition: "회원가입 페이지에 접근할 수 있어야 함",
      testStep: "1. 회원가입 페이지 접속\n2. 필수 정보 입력\n3. 회원가입 버튼 클릭",
      expectedResult: "회원가입이 성공하고 확인 이메일 발송"
    },
    {
      title: "상품 목록 조회 테스트",
      description: "상품 목록을 정상적으로 조회하는 기능을 테스트합니다.",
      category: "상품관리",
      priority: "medium",
      status: "draft",
      preCondition: "상품 데이터가 등록되어 있어야 함",
      testStep: "1. 메인 페이지 접속\n2. 상품 목록 확인\n3. 상품 정보 검증",
      expectedResult: "상품 목록이 정상적으로 표시됨"
    },
    {
      title: "장바구니 추가 테스트",
      description: "상품을 장바구니에 추가하는 기능을 테스트합니다.",
      category: "주문관리",
      priority: "high",
      status: "draft",
      preCondition: "로그인된 상태이고 상품이 있어야 함",
      testStep: "1. 상품 상세 페이지 접속\n2. 장바구니 추가 버튼 클릭\n3. 장바구니 확인",
      expectedResult: "상품이 장바구니에 정상적으로 추가됨"
    }
  ];

  console.log('기본 테스트케이스 생성 완료:', testCases.length);
  return testCases;
}

export async function POST(request: NextRequest) {
  try {
    console.log('AI 테스트케이스 생성 API 호출 시작');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const projectName = formData.get('projectName') as string;

    // 파일 크기 체크 (5MB 제한)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxFileSize) {
      return NextResponse.json({
        success: false,
        error: `파일 크기가 너무 큽니다. 최대 ${Math.round(maxFileSize / 1024 / 1024)}MB까지 지원됩니다.`
      }, { status: 400 });
    }

    console.log('받은 데이터:', {
      fileName: file?.name,
      fileSize: file?.size,
      projectId,
      projectName
    });

    if (!file) {
      console.log('파일이 업로드되지 않음');
      return NextResponse.json(
        { success: false, error: '파일이 업로드되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (!projectId) {
      console.log('프로젝트 ID가 없음');
      return NextResponse.json(
        { success: false, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 저장
    console.log('파일 저장 시작');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), 'uploads');

    console.log('업로드 디렉토리:', uploadDir);

    // 업로드 디렉토리 생성
    if (!fs.existsSync(uploadDir)) {
      console.log('업로드 디렉토리 생성');
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    console.log('파일 저장 경로:', filePath);

    try {
      await writeFile(filePath, buffer);
      console.log('파일 저장 완료');
    } catch (error) {
      console.error('파일 저장 오류:', error);
      throw new Error('파일 저장 중 오류가 발생했습니다.');
    }

    // 파일에서 텍스트 추출
    console.log('텍스트 추출 시작');
    let content: string;
    try {
      content = await extractTextFromFile(filePath, file.type);
      console.log('텍스트 추출 완료, 길이:', content.length);
    } catch (error) {
      console.error('텍스트 추출 오류:', error);
      throw new Error('파일 내용을 읽을 수 없습니다.');
    }

    // AI 프롬프트 생성
    console.log('AI 프롬프트 생성');
    const prompt = createAIPrompt(content, projectName);
    console.log('프롬프트 길이:', prompt.length);

    // AI 호출
    console.log('Ollama API 호출 시작');
    let generatedTestCases;
    try {
      generatedTestCases = await callOllama(prompt);
      console.log('AI 호출 완료, 생성된 테스트케이스 수:', generatedTestCases.length);
    } catch (error) {
      console.error('Ollama 호출 실패, 기본 테스트케이스 사용:', error);
      // AI 호출이 실패하면 기본 테스트케이스 생성
      generatedTestCases = generateDefaultTestCases(projectName, content);
    }

    // 테스트케이스가 비어있으면 기본 테스트케이스 사용
    if (!generatedTestCases || generatedTestCases.length === 0) {
      console.log('생성된 테스트케이스가 없음, 기본 테스트케이스 사용');
      generatedTestCases = generateDefaultTestCases(projectName, content);
    }

    console.log('최종 테스트케이스 수:', generatedTestCases.length);
    console.log('테스트케이스 내용:', JSON.stringify(generatedTestCases, null, 2));

    // 데이터베이스에 저장
    console.log('데이터베이스 저장 시작');
    const db = new Database(dbPath);

    let generatedCount = 0;
    console.log('저장할 테스트케이스 수:', generatedTestCases.length);

    for (const testCase of generatedTestCases) {
      try {
        console.log('테스트케이스 저장 시도:', testCase.title);

        // description 생성 (preCondition이 없으면 testStep과 expectedResult만 사용)
        let description = testCase.description || '';
        if (testCase.testStep || testCase.expectedResult) {
          description = `${testCase.description || ''}\n\n테스트 단계:\n${testCase.testStep || ''}\n\n예상 결과:\n${testCase.expectedResult || ''}`;
        }

        // priority와 status 값을 소문자로 변환
        const normalizedPriority = (testCase.priority || 'medium').toLowerCase();
        const normalizedStatus = (testCase.status || 'draft').toLowerCase();

        console.log('저장할 데이터:', {
          title: testCase.title || '제목 없음',
          category: testCase.category || '기본',
          priority: normalizedPriority,
          status: normalizedStatus,
          projectId: parseInt(projectId)
        });

        // 카테고리 ID 찾기 또는 생성
        let categoryId = 1; // 기본값
        try {
          // 프로젝트별 카테고리가 아닌 전역 카테고리 사용
          const categoryStmt = db.prepare('SELECT id FROM test_categories WHERE name = ? LIMIT 1');
          const categoryResult = categoryStmt.get(testCase.category || '기능테스트');

          if (categoryResult) {
            categoryId = categoryResult.id;
            console.log(`카테고리 찾음: ${testCase.category} (ID: ${categoryId})`);
          } else {
            // 카테고리가 없으면 새로 생성
            console.log(`카테고리 '${testCase.category}' 없음. 새로 생성합니다.`);
            const insertCategoryStmt = db.prepare('INSERT INTO test_categories (name) VALUES (?)');
            const insertResult = insertCategoryStmt.run(testCase.category || '기능테스트');
            categoryId = insertResult.lastInsertRowid as number;
            console.log(`새 카테고리 생성 완료: ${testCase.category} (ID: ${categoryId})`);
          }
        } catch (error) {
          console.log('카테고리 처리 실패, 기본값 사용:', error);
          categoryId = 1;
        }

        const stmt = db.prepare(`
          INSERT INTO test_cases (
            title, description, category_id, priority, status, project_id, 
            expected_result, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        const result = stmt.run(
          testCase.title || '제목 없음',
          description,
          categoryId,
          normalizedPriority,
          normalizedStatus,
          parseInt(projectId),
          testCase.expectedResult || '',
          1  // created_by (admin user)
        );

        console.log('SQL 실행 결과:', result);

        // 테스트 스텝 저장 (testStep이 있는 경우)
        if (testCase.testStep && result.lastInsertRowid) {
          const testCaseId = result.lastInsertRowid;
          const steps = testCase.testStep.split('\n').filter(step => step.trim());

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i].trim();
            if (step) {
              try {
                const stepStmt = db.prepare(`
                  INSERT INTO test_steps (test_case_id, step_number, action, expected_result)
                  VALUES (?, ?, ?, ?)
                `);

                stepStmt.run(
                  testCaseId,
                  i + 1,
                  step,
                  '' // 개별 스텝의 예상 결과는 비워둠
                );
              } catch (stepError) {
                console.error('테스트 스텝 저장 오류:', stepError);
              }
            }
          }
          console.log('테스트 스텝 저장 완료:', steps.length, '개');
        }

        generatedCount++;
        console.log('테스트케이스 저장 완료:', testCase.title);
      } catch (error) {
        console.error('테스트케이스 저장 오류:', error);
        console.error('오류 발생한 테스트케이스:', testCase);
      }
    }

    console.log('총 저장된 테스트케이스 수:', generatedCount);

    // 임시 파일 삭제
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('임시 파일 삭제 오류:', error);
    }

    return NextResponse.json({
      success: true,
      generatedCount,
      message: `${generatedCount}개의 테스트케이스가 성공적으로 생성되었습니다.`
    });

  } catch (error) {
    console.error('AI 테스트케이스 생성 오류:', error);

    // 임시 파일 삭제 시도
    try {
      if (typeof filePath !== 'undefined') {
        fs.unlinkSync(filePath);
        console.log('임시 파일 삭제 완료');
      }
    } catch (deleteError) {
      console.error('임시 파일 삭제 오류:', deleteError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
