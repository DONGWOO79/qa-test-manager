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
          const pdfParse = (await import('pdf-parse')).default;
          const pdfResult = await pdfParse(fileContent, {
            max: 10 // 최대 10페이지만 처리
          });
          
          // 텍스트 길이 제한 (너무 긴 경우 앞부분만 사용)
          let text = pdfResult.text;
          if (text.length > 5000) {
            text = text.substring(0, 5000) + "... (내용이 너무 길어서 앞부분만 사용)";
            console.log('PDF 텍스트 길이 제한 적용:', text.length);
          }
          
          return text;
        } catch (pdfError) {
          console.error('PDF 처리 오류:', pdfError);
          // PDF 처리 실패 시 기본 텍스트 반환
          return "PDF 파일 내용을 분석할 수 없습니다. 기본 테스트케이스를 생성합니다.";
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

// AI 프롬프트 생성 (Ollama 최적화)
function createAIPrompt(content: string, projectName: string): string {
  // 내용이 너무 길면 요약
  let processedContent = content;
  if (content.length > 3000) {
    processedContent = content.substring(0, 3000) + "... (내용이 너무 길어서 앞부분만 사용)";
    console.log('프롬프트 내용 길이 제한 적용:', processedContent.length);
  }
  
  return `
당신은 한국어 QA 테스트 엔지니어입니다. 반드시 한국어로만 응답하세요.

프로젝트명: ${projectName}

요구사항:
${processedContent}

다음 형식으로 5-10개의 테스트케이스를 생성하세요. 모든 내용은 반드시 한국어로 작성하세요:

⚠️ 중요: 모든 텍스트는 반드시 한국어로만 작성하세요. 영어 사용 금지!

Test Case 1: [한국어 테스트케이스 제목]
Title: [한국어 테스트케이스 제목]
Description: [한국어로 테스트케이스 설명]
Category: [한국어 카테고리 - 예: 로그인, 회원가입, 상품관리, 주문관리, 결제시스템]
Priority: [High/Medium/Low]
Status: Not Run
Pre Condition: [한국어로 사전조건]
Test Steps: [한국어로 테스트 단계]
Expected Result: [한국어로 예상 결과]

Test Case 2: [한국어 테스트케이스 제목]
Title: [한국어 테스트케이스 제목]
Description: [한국어로 테스트케이스 설명]
Category: [한국어 카테고리]
Priority: [High/Medium/Low]
Status: Not Run
Pre Condition: [한국어로 사전조건]
Test Steps: [한국어로 테스트 단계]
Expected Result: [한국어로 예상 결과]

중요한 규칙:
1. 모든 텍스트는 반드시 한국어로 작성하세요
2. 영어나 다른 언어 사용 금지
3. 각 주요 기능에 대한 테스트케이스 생성
4. 사용자 시나리오 기반 테스트 포함
5. 경계값 테스트 포함
6. 예외 처리 테스트 포함
7. 각 테스트케이스를 구체적이고 실행 가능하게 작성
8. 실용적인 테스트 시나리오에 집중

위 형식으로만 응답하고 추가 설명은 포함하지 마세요. 모든 내용은 한국어로만 작성하세요.
`;
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
        model: 'llama2',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2000
        }
      }),
      signal: AbortSignal.timeout(60000) // 60초 타임아웃
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
      const testCases = JSON.parse(result.response);
      if (Array.isArray(testCases)) {
        return testCases;
      }
    } catch (parseError) {
      console.log('JSON 파싱 실패, 텍스트에서 테스트케이스 추출 시도...');
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
    throw new Error(`AI 서비스 호출 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

// 텍스트에서 테스트케이스 추출하는 함수 (개선)
function extractTestCasesFromText(text: string): any[] {
  const testCases = [];
  
  console.log('텍스트에서 테스트케이스 추출 시작');
  console.log('텍스트 길이:', text.length);
  
  // Test Case 패턴 찾기
  const testCasePattern = /Test Case \d+[:\s]*([^\n]+)/gi;
  let match;
  let count = 0;
  
  while ((match = testCasePattern.exec(text)) && count < 10) {
    const title = match[1].trim();
    console.log(`테스트케이스 ${count + 1}:`, title);
    
    // 해당 테스트케이스의 전체 섹션 찾기
    const testCaseStart = text.indexOf(match[0]);
    const nextTestCase = text.indexOf(`Test Case ${count + 2}:`, testCaseStart);
    const testCaseSection = text.substring(testCaseStart, nextTestCase > 0 ? nextTestCase : text.length);
    
    // 각 필드 추출
    const descriptionMatch = testCaseSection.match(/Description[:\s]*([^\n]+)/i);
    const categoryMatch = testCaseSection.match(/Category[:\s]*([^\n]+)/i);
    const priorityMatch = testCaseSection.match(/Priority[:\s]*([^\n]+)/i);
    const preConditionMatch = testCaseSection.match(/Pre Condition[:\s]*([^\n]+)/i);
    const testStepsMatch = testCaseSection.match(/Test Steps[:\s]*([^\n]+)/i);
    const expectedResultMatch = testCaseSection.match(/Expected Result[:\s]*([^\n]+)/i);
    
    // 카테고리 한글 매핑
    let category = categoryMatch ? categoryMatch[1].trim() : "기본";
    if (category.toLowerCase().includes('functional')) category = "기능테스트";
    if (category.toLowerCase().includes('security')) category = "보안테스트";
    if (category.toLowerCase().includes('performance')) category = "성능테스트";
    if (category.toLowerCase().includes('usability')) category = "사용성테스트";
    if (category.toLowerCase().includes('integration')) category = "통합테스트";
    
    testCases.push({
      title: title,
      description: descriptionMatch ? descriptionMatch[1].trim() : `테스트케이스 ${count + 1}에 대한 상세 설명`,
      category: category,
      priority: priorityMatch ? priorityMatch[1].trim().toLowerCase() : "medium",
      status: "draft",
      preCondition: preConditionMatch ? preConditionMatch[1].trim() : "테스트 환경이 준비되어 있어야 함",
      testStep: testStepsMatch ? testStepsMatch[1].trim() : `1. ${title} 기능 접근\n2. 기능 테스트 실행\n3. 결과 확인`,
      expectedResult: expectedResultMatch ? expectedResultMatch[1].trim() : "기능이 정상적으로 작동함"
    });
    count++;
  }
  
  // 패턴이 없으면 기본 테스트케이스 생성
  if (testCases.length === 0) {
    console.log('패턴을 찾을 수 없음, 기본 테스트케이스 생성');
    testCases.push({
      title: "기본 기능 테스트",
      description: "시스템의 기본 기능을 테스트합니다.",
      category: "기본",
      priority: "medium",
      status: "draft",
      preCondition: "시스템이 정상적으로 실행되어야 함",
      testStep: "1. 시스템 접속\n2. 기본 기능 확인\n3. 결과 검증",
      expectedResult: "시스템이 정상적으로 작동함"
    });
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
    
    // 테스트케이스가 비어있으면 기본 테스트케이스 사용
    if (!generatedTestCases || generatedTestCases.length === 0) {
      console.log('생성된 테스트케이스가 없음, 기본 테스트케이스 사용');
      generatedTestCases = generateDefaultTestCases(projectName, content);
    }

    // 데이터베이스에 저장
    console.log('데이터베이스 저장 시작');
    const db = new Database(dbPath);
    
    let generatedCount = 0;
    console.log('저장할 테스트케이스 수:', generatedTestCases.length);
    
    for (const testCase of generatedTestCases) {
      try {
        console.log('테스트케이스 저장 시도:', testCase.title);
        const description = `사전 조건: ${testCase.preCondition || ''}\n확인 방법: ${testCase.testStep || ''}\n기대 결과: ${testCase.expectedResult || ''}`;
        
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
        
        // 카테고리 ID 찾기 (기본값: 2)
        let categoryId = 2;
        try {
          const categoryStmt = db.prepare('SELECT id FROM test_categories WHERE name LIKE ? LIMIT 1');
          const categoryResult = categoryStmt.get(`%${testCase.category || '기본'}%`);
          if (categoryResult) {
            categoryId = categoryResult.id;
          }
        } catch (error) {
          console.log('카테고리 검색 실패, 기본값 사용:', error);
        }
        
        const stmt = db.prepare(`
          INSERT INTO test_cases (
            title, description, category_id, priority, status, project_id, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);
        
        const result = stmt.run(
          testCase.title || '제목 없음',
          description,
          categoryId,
          normalizedPriority,
          normalizedStatus,
          parseInt(projectId),
          1  // created_by (admin user)
        );
        
        console.log('SQL 실행 결과:', result);
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
