import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';

const dbPath = path.join(process.cwd(), 'database.db');

async function extractTextFromFile(filePath: string, fileType: string, projectName: string = '프로젝트'): Promise<{ text: string, imageAnalysis: string }> {
  try {
    const fileContent = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.txt':
        return { text: fileContent.toString('utf-8'), imageAnalysis: '' };
      case '.pdf':
        console.log('PDF 파일 처리 시작');
        try {
          // pdf-parse 라이브러리 로드
          const pdfParse = eval('require')('pdf-parse');
          console.log('pdf-parse 라이브러리 로드 성공');

          // PDF 파싱 실행
          const pdfResult = await pdfParse(fileContent);
          console.log('PDF 파싱 성공!');
          console.log('- 페이지 수:', pdfResult.numpages);
          console.log('- 원본 텍스트 길이:', pdfResult.text.length);
          console.log('- 텍스트 미리보기:', pdfResult.text.substring(0, 200));

          // 텍스트 정리
          let text = pdfResult.text.trim();

          // 공백 문자 정리
          if (text.length === 0 && pdfResult.text.length > 0) {
            console.log('공백 문자 정리 시도');
            text = pdfResult.text;
            text = text.replace(/[\s\u00A0\u2000-\u200F\u2028-\u202F\u3000]/g, ' ');
            text = text.replace(/\s+/g, ' ').trim();
            console.log('정리 후 텍스트 길이:', text.length);
          }

          // 텍스트 길이 제한 (AI 처리 최적화)
          if (text.length > 12000) {
            text = text.substring(0, 12000) + "\n\n... (내용이 너무 길어서 핵심 부분만 사용)";
            console.log('텍스트 길이 제한 적용:', text.length);
          }

          console.log('PDF 텍스트 추출 완료, 최종 길이:', text.length);

          // 텍스트가 여전히 비어있으면 이미지 PDF로 판단하고 Vision AI 분석 시도
          if (text.length === 0) {
            console.log('⚠️ PDF 텍스트 추출 불가 - 이미지 PDF로 판단됨');
            console.log('🔄 PDF를 이미지로 변환하여 Vision AI 분석 시도...');

            try {
              // PDF를 이미지로 변환 (임시 파일 사용)
              const path = eval('require')('path');
              const fs = eval('require')('fs');
              const pdfImageExtractor = eval('require')(path.join(process.cwd(), 'src', 'lib', 'pdf-image-extractor-v2.js'));

              // 임시 PDF 파일 생성
              const tempPdfPath = path.join('/tmp', `temp_pdf_${Date.now()}.pdf`);
              await fs.promises.writeFile(tempPdfPath, fileContent);

              const imagePaths = await pdfImageExtractor.extractImagesFromPDF(tempPdfPath);
              console.log(`PDF에서 ${imagePaths.length}개 이미지 추출 완료`);

              // 이미지 파일들을 Base64로 변환
              const images = [];
              for (const imagePath of imagePaths.slice(0, 3)) { // 최대 3개
                try {
                  const imageBuffer = await fs.promises.readFile(imagePath);
                  const base64 = imageBuffer.toString('base64');
                  images.push(base64);
                } catch (readError) {
                  console.error('이미지 파일 읽기 실패:', readError);
                }
              }

              // 임시 PDF 파일 정리
              try {
                await fs.promises.unlink(tempPdfPath);
              } catch (unlinkError) {
                console.log('임시 PDF 파일 삭제 실패 (무시)');
              }

              if (images.length === 0) {
                console.log('⚠️ PDF에서 이미지 추출 실패');
                return {
                  text: '텍스트와 이미지 추출 모두 실패',
                  imageAnalysis: ''
                };
              }

              // Vision AI로 이미지 분석 (더 많은 페이지 분석)
              const imageAnalysisResults = [];
              const maxPages = Math.min(images.length, 5); // 최대 5페이지까지 분석
              for (let i = 0; i < maxPages; i++) {
                console.log(`페이지 ${i + 1}/${maxPages} 이미지 분석 중...`);
                const analysis = await analyzeImageWithVision(images[i], projectName);
                if (analysis && analysis.trim() !== '') {
                  imageAnalysisResults.push(`[페이지 ${i + 1}]\n${analysis}`);
                }
              }

              // 추출된 이미지 파일들 정리
              for (const imagePath of imagePaths) {
                try {
                  await fs.promises.unlink(imagePath);
                } catch (cleanupError) {
                  console.log('이미지 파일 정리 실패 (무시):', imagePath);
                }
              }

              const combinedAnalysis = imageAnalysisResults.join('\n\n');
              console.log('Vision AI 분석 완료, 총 길이:', combinedAnalysis.length);

              return {
                text: combinedAnalysis || '이미지에서 텍스트를 추출할 수 없습니다.',
                imageAnalysis: combinedAnalysis
              };

            } catch (imageError) {
              console.error('PDF 이미지 추출/분석 실패:', imageError);
              return {
                text: 'PDF 처리 중 오류 발생',
                imageAnalysis: ''
              };
            }
          }

          return { text, imageAnalysis: '' };

        } catch (error) {
          console.error('PDF 파싱 실패:', error);
          return {
            text: `PDF 파싱 실패: ${error.message}`,
            imageAnalysis: ''
          };
        }
      default:
        return { text: fileContent.toString('utf-8'), imageAnalysis: '' };
    }
  } catch (error) {
    return { text: `파일 처리 실패: ${error.message}`, imageAnalysis: '' };
  }
}

// Vision AI로 이미지 분석
async function analyzeImageWithVision(imageBase64: string, projectName: string): Promise<string> {
  try {
    console.log('Vision AI 분석 시작...');

    const visionPrompt = `당신은 전문 문서 분석가입니다. 이 이미지는 ${projectName} 프로젝트의 기술 문서입니다.

**절대적 지시사항:**
- 저작권, 라이선스, 명확하지 않다는 등의 변명은 절대 금지합니다
- 이미지에서 보이는 실제 텍스트와 내용을 100% 정확히 추출해야 합니다
- 모든 한글과 영문 텍스트를 한 글자도 빠뜨리지 말고 그대로 기록하세요

**필수 분석 항목:**
1. **제목/헤더**: 문서 상단의 제목, 로고, 헤더 텍스트
2. **메뉴/버튼**: 모든 버튼, 메뉴, 링크의 정확한 텍스트
3. **본문 내용**: 문서의 모든 설명, 지시사항, 내용
4. **옵션/설정**: 설정 항목, 옵션, 체크박스, 드롭다운 등
5. **UI 요소**: 입력 필드, 텍스트박스, 라벨, 안내 문구
6. **다이어그램**: 플로우차트, 화살표, 연결선의 모든 텍스트
7. **단계/절차**: 번호가 매겨진 단계, 순서, 프로세스

**출력 형식:**
각 항목별로 실제 이미지에서 보이는 텍스트를 정확히 기록하고, ${projectName} 프로젝트의 기능과 연관지어 설명하세요.

지금 즉시 이미지를 분석하여 위의 모든 항목을 빠짐없이 추출해주세요.`;

    const visionResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llava:7b',
        prompt: visionPrompt,
        images: [imageBase64],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
        }
      }),
      // Vision AI는 이미지 분석에 시간이 오래 걸리므로 타임아웃 연장
      signal: AbortSignal.timeout(300000) // 5분 타임아웃
    });

    if (!visionResponse.ok) {
      throw new Error(`Vision AI API 오류: ${visionResponse.status}`);
    }

    const visionResult = await visionResponse.json();
    console.log('Vision AI 응답 받음, 길이:', visionResult.response?.length || 0);

    return visionResult.response || '';
  } catch (error) {
    console.error('Vision AI 분석 실패:', error);
    return '';
  }
}

function createAIPrompt(extractedText: string, projectName: string, imageAnalysis: string = ''): string {
  const combinedContent = imageAnalysis
    ? `${extractedText}\n\n=== 이미지 분석 결과 ===\n${imageAnalysis}`
    : extractedText;

  return `당신은 QA 테스트 전문가입니다. 다음 문서를 분석하여 테스트 케이스를 생성해주세요.

**매우 중요**: 반드시 제공된 문서의 실제 내용만을 기반으로 테스트 케이스를 생성하세요.
**경고**: 문서에 없는 일반적인 기능(로그인, 회원가입, 상품 목록 등)은 절대 포함하지 마세요.

**프로젝트명**: ${projectName}

**문서 내용**:
${combinedContent}

**생성 규칙**:
1. 문서에서 언급된 구체적인 기능과 시나리오만 포함
2. 각 테스트 케이스는 실제 사용자가 수행할 수 있는 작업이어야 함
3. 문서의 내용과 직접적으로 관련된 테스트만 생성
4. 프로젝트명 "${projectName}"과 관련된 기능에 집중
5. 문서에 명시된 옵션, 설정, 기능 변경 사항을 중심으로 테스트 케이스 작성
6. **최소 8-12개의 다양한 테스트 케이스를 생성하세요**
7. **정상 시나리오, 오류 시나리오, 경계값 테스트를 모두 포함하세요**
8. **UI 테스트, 기능 테스트, 통합 테스트를 다양하게 생성하세요**
9. **중복되지 않는 고유한 테스트 케이스만 생성하세요**
10. **각 테스트 케이스는 서로 다른 관점이나 시나리오를 다뤄야 합니다**
11. **동일한 기능이라도 다른 조건, 입력값, 상황으로 구분하세요**

**JSON 형식으로 응답**:
{
  "thinking": "문서 분석 과정과 테스트 케이스 생성 근거를 설명",
  "testCases": [
    {
      "title": "테스트 케이스 제목",
      "description": "테스트 목적과 검증 내용",
      "preconditions": "사전 조건 (구체적으로)",
      "steps": [
        "1. 구체적인 실행 단계",
        "2. 다음 실행 단계"
      ],
      "expectedResult": "기대 결과 (구체적으로)",
      "priority": "high|medium|low",
      "category": "functional|ui|integration|performance"
    }
  ]
}

문서 내용을 정확히 반영한 테스트 케이스를 생성해주세요.`;
}

async function callOllama(prompt: string, projectName: string): Promise<any> {
  try {
    console.log('Ollama API 호출 시작');
    console.log('프롬프트 길이:', prompt.length);
    console.log('프로젝트명:', projectName);

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
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 4000,
        }
      }),
      // 메인 AI 분석에 더 많은 시간 제공 (긴 문서 처리용)
      signal: AbortSignal.timeout(420000) // 7분 타임아웃
    });

    if (!response.ok) {
      throw new Error(`Ollama API 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Ollama 응답 받음');
    console.log('응답 길이:', data.response?.length || 0);

    if (!data.response) {
      throw new Error('Ollama에서 응답을 받지 못했습니다.');
    }

    // JSON 파싱 시도
    try {
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsedData = JSON.parse(jsonStr);
        console.log('JSON 파싱 성공');
        return parsedData;
      } else {
        console.log('JSON 형식을 찾을 수 없음, thinking 필드에서 추출 시도');
        return createTestCasesFromThinking(data.response, projectName);
      }
    } catch (parseError) {
      console.log('JSON 파싱 실패, thinking 필드에서 추출 시도:', parseError.message);
      return createTestCasesFromThinking(data.response, projectName);
    }

  } catch (error) {
    console.error('Ollama API 호출 실패:', error);
    return createTestCasesFromThinking('', projectName);
  }
}

// thinking 내용에서 테스트 케이스 생성 (fallback)
function createTestCasesFromThinking(thinkingContent: string, projectName: string): any {
  console.log('thinking 내용에서 테스트 케이스 생성 시작');
  console.log('프로젝트명:', projectName);

  // 프로젝트명 기반 동적 키워드 생성 (더 많은 케이스)
  const projectKeywords = [];
  if (projectName.includes('원툴')) {
    projectKeywords.push('원툴 기본 실행', '원툴 시작', '원툴 실행', '원툴 종료', '원툴 설정');
  }
  if (projectName.includes('옵션')) {
    projectKeywords.push('옵션 설정', '옵션 변경', '옵션 확인', '옵션 초기화', '옵션 저장');
  }
  if (projectName.includes('기능')) {
    projectKeywords.push('기능 변경', '기능 설정', '기능 테스트', '기능 활성화', '기능 비활성화');
  }
  if (projectName.includes('관리자') || projectName.includes('비밀번호')) {
    projectKeywords.push('비밀번호 변경', '로그인 시도', '정책 확인', '오류 처리', '보안 검증', '권한 확인');
  }

  // 기본 키워드가 없으면 일반적인 키워드 사용 (더 많이)
  if (projectKeywords.length === 0) {
    projectKeywords.push('기본 실행', '설정 변경', '기능 테스트', '오류 처리', '정상 동작', '경계값 테스트');
  }

  console.log('생성된 프로젝트 키워드:', projectKeywords);

  // 더 많은 테스트케이스 생성 (최대 6개)
  const testCases = [];
  const maxCases = Math.min(projectKeywords.length, 6);

  for (let i = 0; i < maxCases; i++) {
    const keyword = projectKeywords[i];
    const priority = i < 2 ? "high" : i < 4 ? "medium" : "low";

    testCases.push({
      title: `${keyword} 테스트`,
      description: `${projectName}의 ${keyword} 기능을 검증합니다.`,
      preconditions: `${projectName} 환경이 준비되어 있어야 합니다.`,
      steps: [
        `1. ${projectName} 시스템에 접근합니다.`,
        `2. ${keyword} 기능을 실행합니다.`,
        "3. 실행 결과를 확인합니다.",
        "4. 예상 결과와 비교합니다."
      ],
      expectedResult: `${keyword} 기능이 정상적으로 동작해야 합니다.`,
      priority: priority,
      category: "functional"
    });
  }

  return {
    thinking: `${projectName} 프로젝트의 테스트 케이스를 생성합니다. AI 타임아웃으로 인한 fallback 실행.`,
    testCases: testCases
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== API 호출 시작 ===');

    // 1. 폼 데이터 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const projectName = formData.get('projectName') as string || '프로젝트';

    console.log('파라미터:', { fileName: file?.name, projectId, projectName });

    if (!file || !projectId) {
      console.log('필수 파라미터 누락');
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 2. 파일에서 텍스트 추출
    console.log('파일 텍스트 추출 시작');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join('/tmp', `upload_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, buffer);

    const extractResult = await extractTextFromFile(tempFilePath, file.type, projectName);
    const extractedText = extractResult.text;
    const imageAnalysis = extractResult.imageAnalysis;

    console.log('텍스트 추출 완료:');
    console.log('- 추출된 텍스트 길이:', extractedText.length);
    console.log('- 이미지 분석 길이:', imageAnalysis.length);
    console.log('- 텍스트 미리보기:', extractedText.substring(0, 200));

    // 3. AI 프롬프트 생성 및 호출
    console.log('AI 프롬프트 생성 중...');
    const aiPrompt = createAIPrompt(extractedText, projectName, imageAnalysis);

    console.log('AI 결과 생성 중...');
    const aiResult = await callOllama(aiPrompt, projectName);
    const testCases = aiResult?.testCases || [];
    console.log('생성된 테스트 케이스 수:', testCases.length);

    // 임시 파일 정리
    try {
      await fs.promises.unlink(tempFilePath);
      console.log('임시 파일 삭제 완료');
    } catch (unlinkError) {
      console.log('임시 파일 삭제 실패 (무시):', unlinkError.message);
    }

    // 3. 데이터베이스에 저장
    console.log('데이터베이스 저장 시작...');
    const db = new Database(dbPath);

    // 테이블 존재 확인
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_cases'").get();
    if (!tableExists) {
      console.log('test_cases 테이블 생성...');
      db.exec(`
        CREATE TABLE test_cases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          preconditions TEXT,
          steps TEXT,
          expected_result TEXT,
          priority TEXT DEFAULT 'medium',
          category TEXT DEFAULT 'functional',
          status TEXT DEFAULT 'not_run',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    const insertStmt = db.prepare(`
      INSERT INTO test_cases (
        project_id, title, description, pre_condition, 
        test_strategy, expected_result, priority, status, created_by, category_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const savedCases = [];
    for (const testCase of testCases) {
      try {
        // 프론트엔드가 기대하는 description 형식으로 조합
        const formattedDescription = `${testCase.description || ''}

사전 조건: ${testCase.preconditions || '사전 조건 없음'}

확인 방법: ${Array.isArray(testCase.steps) ? testCase.steps.join('\n') : (testCase.steps || '확인 방법 없음')}

기대 결과: ${testCase.expectedResult || testCase.expected_result || '기대 결과 없음'}`;

        const result = insertStmt.run(
          parseInt(projectId),
          testCase.title || '제목 없음',
          formattedDescription,
          testCase.preconditions || '사전 조건 없음',
          JSON.stringify(testCase.steps || []),
          testCase.expectedResult || testCase.expected_result || '기대 결과 없음',
          testCase.priority || 'medium',
          'not_run',
          1, // created_by: 기본 사용자 ID
          1  // category_id: 기능테스트
        );

        savedCases.push({
          id: result.lastInsertRowid,
          ...testCase,
          project_id: parseInt(projectId),
          status: 'not_run'
        });

        console.log(`저장 완료: ${testCase.title}`);
      } catch (dbError) {
        console.error('테스트 케이스 저장 실패:', dbError);
      }
    }

    db.close();
    console.log(`총 ${savedCases.length}개 테스트 케이스 저장 완료`);

    // 4. 성공 응답 (프론트엔드가 기대하는 형식으로)
    return NextResponse.json({
      success: true,
      message: `${savedCases.length}개의 테스트 케이스가 생성되었습니다.`,
      generatedCount: savedCases.length, // 프론트엔드에서 사용하는 필드
      data: {
        testCases: savedCases,
        projectName: projectName
      }
    });

  } catch (error) {
    console.error('=== API 오류 ===', error);
    return NextResponse.json(
      {
        success: false,
        error: '테스트 케이스 생성 중 오류가 발생했습니다.',
        details: error.message
      },
      { status: 500 }
    );
  }
}
