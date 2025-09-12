import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';

// Google Cloud Vision API
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Spec Kit 관련 import
import {
  SpecKitSpecification,
  ExtractedContent,
  SpecKitGenerationResult,
  TestCaseGenerationContext
} from '@/types/spec-kit';
import { SpecKitGenerator, SpecKitValidator } from '@/lib/spec-kit/spec-kit-utils';
import { SPEC_KIT_CONFIG } from '@/lib/spec-kit/spec-kit-config';

const dbPath = path.join(process.cwd(), 'database.db');

// 진행률 추적 시스템
interface ProgressStep {
  step: string;
  progress: number;
  message: string;
  timestamp: string;
  duration?: number;
}

class ProgressTracker {
  private steps: ProgressStep[] = [];
  private startTime: number = Date.now();

  logStep(step: string, progress: number, message: string) {
    const now = Date.now();
    const duration = this.steps.length > 0 ? now - Date.parse(this.steps[this.steps.length - 1].timestamp) : 0;

    this.steps.push({
      step,
      progress,
      message,
      timestamp: new Date().toISOString(),
      duration
    });

    console.log(`📊 [${progress}%] ${step}: ${message}`);
    if (duration > 0) {
      console.log(`⏱️ 이전 단계 소요시간: ${Math.round(duration / 1000)}초`);
    }
  }

  getProgress() {
    return this.steps;
  }

  getTotalDuration() {
    return Date.now() - this.startTime;
  }

  getCurrentStep() {
    return this.steps.length > 0 ? this.steps[this.steps.length - 1] : null;
  }
}

/**
 * AI 기반 명세화 전문가 - PDF 내용을 상세 명세서로 변환
 */
async function createDetailedSpecificationWithAI(
  extractedText: string,
  imageAnalysis: string
): Promise<string> {
  console.log('🔍 AI 명세화 전문가 시작...');
  console.log('📄 1단계 입력 데이터 분석:');
  console.log(`- 추출된 텍스트 길이: ${extractedText.length}자`);
  console.log(`- 이미지 분석 길이: ${imageAnalysis.length}자`);
  console.log(`- 텍스트 미리보기 (처음 500자):`);
  console.log(`"${extractedText.substring(0, 500)}..."`);
  if (imageAnalysis && imageAnalysis.length > 0) {
    console.log(`- 이미지 분석 미리보기 (처음 200자):`);
    console.log(`"${imageAnalysis.substring(0, 200)}..."`);
  }

  const combinedText = imageAnalysis ?
    `${extractedText}\n\n=== 이미지 분석 결과 ===\n${imageAnalysis}` :
    extractedText;

  console.log(`- 최종 결합된 내용 길이: ${combinedText.length}자`);

  const specificationPrompt = `당신은 첨부 문서 분석 전문가입니다.
다음은 PDF 파일에서 추출한 실제 내용입니다. 이 내용을 바탕으로 **문서에서 설명하는 실제 기능**에 대한 명세서를 작성해주세요.

**첨부 문서에서 추출된 실제 내용**:
${combinedText}

**핵심 원칙**:
✅ **문서에 명시된 내용만 사용**: 문서에서 실제로 언급된 기능, 요구사항, 절차만 포함
✅ **문서의 실제 맥락 반영**: 문서가 설명하는 범위와 목적에 맞는 명세서 작성
✅ **추측 최소화**: 문서에 없는 내용은 "문서에서 명시되지 않음"으로 표시

**주의사항**:
⚠️ 문서에 명시되지 않은 기능을 임의로 추가하지 마세요
⚠️ 일반적인 소프트웨어 관례보다 문서의 실제 내용을 우선하세요
⚠️ 문서가 단순한 경우, 명세서도 그에 맞게 단순하게 작성하세요

**출력 형식**:
## 1. 문서 개요
**문서 제목**: [첨부 문서에서 확인된 실제 제목]
**기능 목적**: [문서에서 설명하는 실제 기능의 목적]
**문서 정보**: [버전, 날짜, 담당자 등 문서에 명시된 메타데이터]

## 2. 문서에서 확인된 요구사항
### 2.1 명시된 기능
- [문서에서 직접 언급된 기능들만 나열]

### 2.2 변경사항 및 버전 정보
- [문서에 포함된 변경 내역, 히스토리 정보]

### 2.3 관련 정보
- [문서에 명시된 담당자, 날짜, 기타 메타데이터]

## 3. 문서 기반 사용자 시나리오
### 3.1 문서에서 추론되는 주요 흐름
[첨부 문서 내용으로부터만 추론되는 사용자 흐름]

## 4. 테스트 대상 기능
### 4.1 문서에서 확인된 테스트 포인트
[첨부 문서에서 테스트해야 할 구체적인 기능들]

**절대 금지사항**: 
- 첨부 문서에 없는 일반적인 기능(로그인, 인증, 암호화 등) 추가 금지
- 추상적이거나 가상의 시나리오 생성 금지
- 문서와 관련 없는 기술적 세부사항 추가 금지
- 일반적인 소프트웨어 기능으로 확장하지 말고 문서 내용에만 집중

**반드시 포함해야 할 내용**:
- 문서에서 추출된 실제 텍스트와 정보 그대로 활용
- 문서에 명시된 구체적인 버전, 날짜, 담당자 정보
- 문서의 실제 목적과 범위에 맞는 기능 명세만 작성`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss:20b',
        prompt: specificationPrompt,
        stream: false,
        options: {
          temperature: 0.2, // 명세화는 정확성이 중요
          top_p: 0.9,
          max_tokens: 6000, // 상세한 명세서를 위해 더 많은 토큰
        }
      }),
      signal: AbortSignal.timeout(300000) // 5분
    });

    if (!response.ok) {
      throw new Error(`AI 명세화 실패: ${response.status}`);
    }

    const result = await response.json();
    const detailedSpec = result.response || '';

    console.log('✅ AI 명세화 완료, 길이:', detailedSpec.length);
    console.log('📋 1단계 AI 명세화 결과 미리보기 (처음 1000자):');
    console.log(`"${detailedSpec.substring(0, 1000)}..."`);
    console.log('📋 1단계 AI 명세화 결과 끝부분 (마지막 500자):');
    console.log(`"...${detailedSpec.substring(Math.max(0, detailedSpec.length - 500))}"`);

    return detailedSpec;

  } catch (error) {
    console.error('❌ AI 명세화 실패:', error);
    return combinedText; // Fallback: 원본 텍스트 반환
  }
}

/**
 * PDF 내용을 Spec Kit 명세서로 변환하는 함수
 */
async function generateSpecKitSpecification(
  extractedText: string,
  imageAnalysis: string,
  projectName: string
): Promise<SpecKitGenerationResult> {
  console.log('🔄 Spec Kit 명세서 생성 시작...');
  console.log('- 텍스트 길이:', extractedText.length);
  console.log('- 이미지 분석 길이:', imageAnalysis.length);

  try {
    // 추출된 내용을 ExtractedContent 형태로 구성
    const extractedContent: ExtractedContent = {
      text: extractedText,
      images: imageAnalysis ? [imageAnalysis] : [],
      metadata: {
        pages: 1,
        title: projectName,
        createdDate: new Date().toISOString()
      }
    };

    // 텍스트와 이미지 분석 결합
    const combinedText = imageAnalysis ?
      `${extractedText}\n\n=== 이미지 분석 결과 ===\n${imageAnalysis}` :
      extractedText;

    extractedContent.text = combinedText;

    // Spec Kit 명세서 생성
    const specResult = await SpecKitGenerator.generateSpecification(extractedContent, projectName);

    console.log('✅ Spec Kit 명세서 생성 완료');
    console.log('- 신뢰도:', specResult.confidence);
    console.log('- 경고 수:', specResult.warnings.length);
    console.log('- 사용자 스토리 수:', specResult.specification.functionality.userStories.length);
    console.log('- 주요 시나리오 수:', specResult.specification.scenarios.primary.length);

    // 명세서 검증
    const validation = SpecKitValidator.validate(specResult.specification);
    if (!validation.isValid) {
      console.log('⚠️ 명세서 검증 오류:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.log('⚠️ 명세서 검증 경고:', validation.warnings);
    }

    return specResult;

  } catch (error) {
    console.error('❌ Spec Kit 명세서 생성 실패:', error);

    // 실패시 기본 명세서 생성
    const fallbackSpec: SpecKitSpecification = {
      id: `spec-${Date.now()}`,
      title: projectName,
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      functionality: {
        overview: extractedText.substring(0, 500) + '...',
        purpose: `${projectName}의 기능 구현`,
        scope: ['기본 기능'],
        userStories: [],
        businessRules: []
      },
      technical: {
        architecture: ['웹 기반 시스템'],
        technologies: ['React', 'TypeScript'],
        integrations: [],
        performance: [],
        security: []
      },
      scenarios: {
        primary: [],
        alternative: [],
        exception: [],
        edge: []
      },
      constraints: {
        functional: [],
        technical: [],
        business: [],
        regulatory: []
      },
      acceptance: {
        functional: [],
        performance: [],
        usability: [],
        security: []
      },
      testStrategy: {
        approach: SPEC_KIT_CONFIG.DEFAULT_TEST_STRATEGIES,
        coverage: SPEC_KIT_CONFIG.DEFAULT_TEST_COVERAGE,
        priorities: [],
        risks: SPEC_KIT_CONFIG.COMMON_TEST_RISKS
      }
    };

    return {
      specification: fallbackSpec,
      confidence: 0.3,
      warnings: ['Spec Kit 생성 실패로 기본 명세서 사용'],
      suggestions: ['PDF 내용을 더 구체적으로 작성하여 재시도하세요.']
    };
  }
}

async function extractTextFromFile(filePath: string, fileType: string, projectName: string = '프로젝트', fileName: string = ''): Promise<{ text: string, imageAnalysis: string }> {
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

          // 텍스트 정리 - 더 강력한 공백 문자 처리
          let text = pdfResult.text;

          console.log('공백 문자 정리 시도');
          // 모든 종류의 공백 문자를 일반 공백으로 변환
          text = text.replace(/[\s\u00A0\u2000-\u200F\u2028-\u202F\u3000]/g, ' ');
          // 연속된 공백을 하나로 압축
          text = text.replace(/\s+/g, ' ');
          // 앞뒤 공백 제거
          text = text.trim();

          console.log('정리 후 텍스트 길이:', text.length);

          // 여전히 비어있다면 원본에서 다른 방식으로 추출 시도
          if (text.length === 0 && pdfResult.text.length > 0) {
            console.log('추가 텍스트 정리 시도 - 특수문자 제거');
            text = pdfResult.text.replace(/[^\w\s가-힣]/g, ' ');
            text = text.replace(/\s+/g, ' ').trim();
            console.log('추가 정리 후 텍스트 길이:', text.length);
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
            console.log('📊 [15%] PDF_IMAGE: PDF 이미지 변환 시작 - MuPDF 피그마 PDF 최적화');

            try {
              // MuPDF mutool로 PDF를 이미지로 변환 (피그마 PDF 벡터/투명도 처리)
              const path = eval('require')('path');
              const fs = eval('require')('fs');
              const pdfImageExtractor = eval('require')(path.join(process.cwd(), 'src', 'lib', 'pdf-image-extractor-mupdf.js'));

              // 임시 PDF 파일 생성
              const tempPdfPath = path.join('/tmp', `temp_pdf_${Date.now()}.pdf`);
              await fs.promises.writeFile(tempPdfPath, fileContent);

              const imagePaths = await pdfImageExtractor.extractImagesFromPDF(tempPdfPath, 300);
              console.log(`📊 [25%] PDF_IMAGE_COMPLETE: PDF에서 ${imagePaths.length}개 이미지 추출 완료 - Vision AI 분석 시작`);

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
                console.log('⚠️ PDF에서 이미지 추출 완전 실패 - PDF.js 호환성 문제');
                console.log('📝 텍스트 기반 분석으로 전환 (pdf-parse 결과 사용)');

                // 텍스트가 있다면 텍스트만으로 진행
                if (text && text.length > 0) {
                  return {
                    text: text,
                    imageAnalysis: 'PDF 이미지 추출 실패로 텍스트만 사용됨'
                  };
                }

                // 텍스트도 이미지도 없으면 실패
                return {
                  text: '텍스트와 이미지 추출 모두 실패',
                  imageAnalysis: ''
                };
              }

              // 🚀 하이브리드 Vision AI 분석 (Google Vision API 우선, Ollama Vision AI 대체)
              const imageAnalysisResults = [];
              const maxPages = Math.min(images.length, 3); // 최대 3페이지까지 분석 (안정성)

              for (let i = 0; i < maxPages; i++) {
                console.log(`페이지 ${i + 1}/${maxPages} 이미지 분석 중...`);
                console.log(`이미지 크기: ${images[i].length} bytes`);
                console.log(`이미지 Base64 시작: ${images[i].substring(0, 100)}...`);

                let analysis = '';

                // 1차 시도: Google Vision API (높은 성능)
                try {
                  console.log(`🔍 Google Vision API 시도 중 (페이지 ${i + 1})...`);
                  analysis = await analyzeImageWithGoogleVision(images[i]);

                  if (analysis && analysis.trim() !== '' && analysis !== '텍스트를 찾을 수 없습니다.') {
                    console.log(`✅ Google Vision API 성공 (페이지 ${i + 1}), 길이: ${analysis.length}`);
                    console.log(`Google Vision 결과 미리보기: ${analysis.substring(0, 300)}...`);
                  } else {
                    throw new Error('Google Vision API에서 텍스트를 추출하지 못함');
                  }
                } catch (googleError) {
                  console.log(`⚠️ Google Vision API 실패 (페이지 ${i + 1}):`, (googleError as Error).message);

                  // 2차 시도: Ollama Vision AI (fallback) - 비활성화 (Google Vision API 전용)
                  console.log(`⚠️ Ollama Vision AI 대체 로직 비활성화됨 - Google Vision API 전용 모드`);
                  analysis = `페이지 ${i + 1}: Google Vision API 전용 모드 - 분석 실패`;
                }

                console.log(`페이지 ${i + 1} 최종 분석 결과 길이: ${analysis?.length || 0}`);
                console.log(`페이지 ${i + 1} 최종 분석 결과 미리보기: ${analysis?.substring(0, 200)}...`);

                if (analysis && analysis.trim() !== '') {
                  imageAnalysisResults.push(`[페이지 ${i + 1}]\n${analysis}`);
                }
              }

              // 추출된 이미지 파일들 자동 정리
              console.log('🧹 추출된 이미지 파일들 자동 정리 중...');
              let cleanedFiles = 0;
              for (const imagePath of imagePaths) {
                try {
                  await fs.promises.unlink(imagePath);
                  cleanedFiles++;
                } catch (cleanupError) {
                  console.log('이미지 파일 삭제 실패:', imagePath);
                }
              }

              // 빈 디렉토리도 정리
              try {
                const imageDir = path.dirname(imagePaths[0]);
                const remainingFiles = await fs.promises.readdir(imageDir);
                if (remainingFiles.length === 0) {
                  await fs.promises.rmdir(imageDir);
                  console.log(`✅ 임시 디렉토리 정리 완료: ${cleanedFiles}개 파일, 1개 디렉토리 삭제`);
                } else {
                  console.log(`✅ 임시 파일 정리 완료: ${cleanedFiles}개 파일 삭제`);
                }
              } catch (dirCleanupError) {
                console.log(`✅ 임시 파일 정리 완료: ${cleanedFiles}개 파일 삭제`);
              }

              const combinedAnalysis = imageAnalysisResults.join('\n\n');
              const successfulAnalyses = imageAnalysisResults.filter(result => result && result.trim().length > 0).length;

              console.log(`\n📊 Vision AI 분석 완료:`);
              console.log(`   ✅ 성공: ${successfulAnalyses}/${maxPages}페이지`);
              console.log(`   📝 총 분석 길이: ${combinedAnalysis.length}자`);

              if (successfulAnalyses > 0 && successfulAnalyses < maxPages) {
                console.log(`   ⚠️ 부분적 성공 - ${successfulAnalyses}개 페이지 분석 결과로 진행`);
              }

              // Vision AI 분석이 실패했을 경우 파일명과 프로젝트명 기반 스마트 fallback
              if (combinedAnalysis.length === 0) {
                // 파일명에서 키워드 추출
                // fileName은 함수 파라미터에서 받음
                const fileKeywords = fileName.toLowerCase();

                let specificFeatures = [];
                if (fileKeywords.includes('개인정보') || fileKeywords.includes('privacy')) {
                  specificFeatures = [
                    '개인정보 수집 동의 화면 표시',
                    '개인정보 처리방침 조회 기능',
                    '동의 항목별 선택/해제 기능',
                    '필수/선택 동의 구분 표시',
                    '개인정보 수집 목적 명시',
                    '개인정보 보유기간 안내',
                    '동의 철회 요청 기능',
                    '개인정보 처리 현황 조회',
                    '제3자 제공 동의 관리',
                    '마케팅 활용 동의 관리',
                    '동의 이력 저장 및 관리',
                    '법정 고지사항 표시 기능'
                  ];
                } else if (fileKeywords.includes('로그인') || fileKeywords.includes('auth')) {
                  specificFeatures = [
                    '로그인 화면 표시',
                    '아이디/비밀번호 입력 검증',
                    '로그인 성공/실패 처리',
                    '세션 관리',
                    '자동 로그인 기능',
                    '비밀번호 찾기',
                    '계정 잠금 해제'
                  ];
                } else {
                  specificFeatures = [
                    '화면 표시 및 렌더링',
                    '사용자 입력 처리',
                    '데이터 검증 및 저장',
                    '오류 처리 및 메시지 표시',
                    '권한 확인 및 접근 제어',
                    '파일 업로드/다운로드',
                    'API 통신 및 응답 처리'
                  ];
                }

                const fallbackText = `"${fileName}" 문서 분석:

파일명을 기반으로 추정되는 주요 기능들:

${specificFeatures.map((feature, index) => `${index + 1}. ${feature}`).join('\n')}

추가 예상 기능:
- 사용자 인터페이스 표시 및 상호작용
- 입력 데이터 유효성 검사
- 서버 통신 및 응답 처리
- 오류 상황 처리 및 사용자 안내
- 보안 및 권한 관리

이러한 기능들을 중심으로 포괄적인 테스트케이스를 생성합니다.`;

                return {
                  text: fallbackText,
                  imageAnalysis: fallbackText
                };
              }

              return {
                text: combinedAnalysis,
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
            text: `PDF 파싱 실패: ${(error as Error).message}`,
            imageAnalysis: ''
          };
        }
      default:
        return { text: fileContent.toString('utf-8'), imageAnalysis: '' };
    }
  } catch (error) {
    return { text: `파일 처리 실패: ${(error as Error).message}`, imageAnalysis: '' };
  }
}

// Google Cloud Vision API로 이미지 분석 (새로운 함수)
async function analyzeImageWithGoogleVision(imageBase64: string): Promise<string> {
  try {
    console.log('Google Vision API 분석 시작...');

    // Google Cloud Vision 클라이언트 초기화 (API 키 방식)
    const client = new ImageAnnotatorClient({
      // API 키 방식 (더 간단)
      apiKey: process.env.GOOGLE_VISION_API_KEY,
      // 또는 서비스 계정 키 파일 방식
      // keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Base64 이미지를 Google Vision API 형식으로 변환
    const request = {
      image: {
        content: imageBase64,
      },
      features: [
        { type: 'TEXT_DETECTION' as const, maxResults: 100 },
        { type: 'DOCUMENT_TEXT_DETECTION' as const, maxResults: 1 },
      ],
      imageContext: {
        languageHints: ['ko', 'en'], // 한국어, 영어 힌트 추가
      },
    };

    // Google Vision API 호출
    const [result] = await client.annotateImage(request);

    console.log('Google Vision API 응답 받음');
    console.log('🔍 Google Vision API 응답 상세 분석:');
    console.log('- fullTextAnnotation 존재:', !!result.fullTextAnnotation);
    console.log('- textAnnotations 존재:', !!result.textAnnotations);
    console.log('- textAnnotations 길이:', result.textAnnotations?.length || 0);

    if (result.fullTextAnnotation) {
      console.log('- fullTextAnnotation.text 존재:', !!result.fullTextAnnotation.text);
      console.log('- fullTextAnnotation.text 길이:', result.fullTextAnnotation.text?.length || 0);
    }

    // 1차: TEXT_DETECTION 결과 (개별 텍스트 주석) - 피그마 PDF에 더 효과적
    const textAnnotations = result.textAnnotations;
    if (textAnnotations && textAnnotations.length > 0) {
      // 첫 번째 annotation은 전체 텍스트, 나머지는 개별 단어/구문
      const extractedText = textAnnotations[0]?.description || '';
      if (extractedText && extractedText.trim().length > 0) {
        console.log('✅ Google Vision TEXT_DETECTION 성공, 길이:', extractedText.length);
        console.log('✅ TEXT_DETECTION 텍스트 미리보기:', extractedText.substring(0, 300));
        return extractedText;
      }
    }

    // 2차: DOCUMENT_TEXT_DETECTION 결과 (전체 문서 구조) - 일반 PDF용
    const fullTextAnnotation = result.fullTextAnnotation;
    if (fullTextAnnotation && fullTextAnnotation.text) {
      console.log('✅ Google Vision DOCUMENT_TEXT_DETECTION 성공, 길이:', fullTextAnnotation.text.length);
      console.log('✅ DOCUMENT_TEXT_DETECTION 텍스트 미리보기:', fullTextAnnotation.text.substring(0, 300));
      return fullTextAnnotation.text;
    }

    console.log('❌ Google Vision에서 텍스트를 전혀 감지하지 못함');
    return '';

  } catch (error) {
    console.error('Google Vision API 분석 실패:', error);
    return '';
  }
}

// Ollama Vision AI로 이미지 분석 (기존 함수)
async function analyzeImageWithVision(imageBase64: string, projectName: string): Promise<string> {
  try {
    console.log('Vision AI 분석 시작...');

    const visionPrompt = `당신은 전문 OCR 문서 분석가입니다. 주어진 이미지에서 모든 텍스트를 정확히 추출해야 합니다.

**절대적 지시사항:**
- 이미지에서 실제로 보이는 텍스트만 추출하세요
- 추측하거나 가정하지 마세요
- 모든 한글, 영문, 숫자를 정확히 기록하세요
- 텍스트가 없으면 "텍스트 없음"이라고 명시하세요

**필수 추출 항목:**
1. **제목/헤더**: 문서 상단의 제목, 로고 텍스트
2. **본문 내용**: 모든 문단, 설명, 지시사항
3. **버튼/메뉴**: 클릭 가능한 요소의 텍스트
4. **입력 필드**: 라벨, 플레이스홀더 텍스트
5. **표/목록**: 테이블 헤더, 목록 항목
6. **안내문**: 주의사항, 설명문, 도움말
7. **번호/단계**: 순서가 있는 내용

**출력 형식:**
각 항목별로 실제 이미지에서 보이는 텍스트를 그대로 기록하세요.
텍스트가 흐릿하거나 불분명한 경우 "[불분명]"으로 표시하세요.

지금 이미지를 분석하여 모든 텍스트를 추출해주세요.`;

    const visionResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'minicpm-v:8b',
        prompt: visionPrompt,
        images: [imageBase64],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_ctx: 4096,  // 컨텍스트 크기 제한
          num_predict: 2048,  // 예측 토큰 수 제한
        }
      }),
      // Vision AI 타임아웃을 10분으로 연장하고 더 자세한 로깅 추가
      signal: AbortSignal.timeout(600000) // 10분 타임아웃
    });

    if (!visionResponse.ok) {
      throw new Error(`Vision AI API 오류: ${visionResponse.status}`);
    }

    const visionResult = await visionResponse.json();
    console.log('Vision AI 응답 받음, 길이:', visionResult.response?.length || 0);
    console.log('Vision AI 응답 미리보기:', visionResult.response?.substring(0, 300) || '');

    return visionResult.response || '';
  } catch (error) {
    console.error('Vision AI 분석 실패:', error);
    // Vision AI 실패 시 기본 분석 텍스트 제공
    return `이미지 분석을 완료할 수 없었습니다. 
문서의 일반적인 기능들을 기반으로 다음과 같은 영역에서 테스트케이스를 생성합니다:
- 사용자 인터페이스 표시 및 상호작용
- 데이터 입력 및 검증
- 파일 처리 및 업로드  
- 화면 표시 및 렌더링
- 오류 처리 및 예외 상황 관리
- 기능 동작 및 응답 검증
문서 내용을 기반으로 관련 테스트케이스를 생성하겠습니다.`;
  }
}

/**
 * Spec Kit 명세서 기반 AI 프롬프트 생성
 */
function createSpecKitBasedPrompt(
  specResult: SpecKitGenerationResult,
  projectName: string,
  maxTestCases: number = 12
): string {
  const spec = specResult.specification;

  // 사용자 스토리 텍스트 생성
  const userStoriesText = spec.functionality.userStories.length > 0
    ? spec.functionality.userStories.map(story =>
      `- ${story.as}로서 ${story.want}을 원한다. 목적: ${story.so}`
    ).join('\n')
    : '명시된 사용자 스토리 없음';

  // 시나리오 텍스트 생성
  const scenariosText = [
    ...spec.scenarios.primary,
    ...spec.scenarios.alternative,
    ...spec.scenarios.exception,
    ...spec.scenarios.edge
  ].map(scenario =>
    `- ${scenario.title}: ${scenario.description}`
  ).join('\n') || '명시된 시나리오 없음';

  // 수용 기준 텍스트 생성
  const acceptanceText = [
    ...spec.acceptance.functional,
    ...spec.acceptance.performance,
    ...spec.acceptance.usability,
    ...spec.acceptance.security
  ].map(criteria => criteria.criterion).join('\n') || '명시된 수용 기준 없음';

  // 제약 조건 텍스트 생성
  const constraintsText = [
    ...spec.constraints.functional,
    ...spec.constraints.technical,
    ...spec.constraints.business,
    ...spec.constraints.regulatory
  ].join('\n') || '명시된 제약 조건 없음';

  return `당신은 QA 테스트 전문가입니다. 다음 Spec Kit 기반 명세서를 분석하여 **한국어로** 체계적이고 포괄적인 테스트케이스를 생성해주세요.

**중요: 모든 출력은 반드시 한국어로 작성해주세요!**

**프로젝트 정보:**
- 프로젝트명: ${projectName}
- 명세서 제목: ${spec.title}
- 명세서 신뢰도: ${Math.round(specResult.confidence * 100)}%

**기능 명세:**
- 개요: ${spec.functionality.overview}
- 목적: ${spec.functionality.purpose}
- 범위: ${spec.functionality.scope.join(', ')}

**사용자 스토리:**
${userStoriesText}

**테스트 시나리오:**
${scenariosText}

**수용 기준:**
${acceptanceText}

**제약 조건:**
${constraintsText}

**기술 요구사항:**
- 아키텍처: ${spec.technical.architecture.join(', ')}
- 기술 스택: ${spec.technical.technologies.join(', ')}

**테스트케이스 생성 지침:**
1. **명세서 기반 생성**: 위의 명세서 내용을 철저히 분석하여 테스트케이스 생성
2. **사용자 스토리 반영**: 각 사용자 스토리별로 최소 1개 이상의 테스트케이스 생성
3. **시나리오 기반**: Primary → Alternative → Exception → Edge 시나리오 순서로 커버
4. **수용 기준 검증**: 모든 수용 기준이 테스트로 검증되도록 설계
5. **제약 조건 고려**: 제약 조건을 위반하는 경우에 대한 테스트 포함

**생성 규칙:**
1. **최소 ${Math.max(8, Math.min(maxTestCases, 15))}개의 다양한 테스트케이스** 생성
2. **테스트 타입 분산**:
   - 기능 테스트 (60%): 핵심 기능 동작 검증
   - UI/UX 테스트 (20%): 사용자 인터페이스 검증
   - 오류 처리 테스트 (15%): 예외 상황 처리
   - 경계값/성능 테스트 (5%): 한계 상황 검증

3. **우선순위 기반 생성**:
   - High (40%): 핵심 기능, 사용자 스토리 기반
   - Medium (40%): 일반 기능, 대안 시나리오
   - Low (20%): 부가 기능, 경계값 테스트

4. **시나리오별 테스트케이스**:
   - Primary 시나리오: 정상 동작 검증
   - Alternative 시나리오: 대안 경로 검증  
   - Exception 시나리오: 오류 상황 처리
   - Edge 시나리오: 경계값 및 극한 상황

5. **구체적이고 실행 가능한 테스트케이스**:
   - 명확한 사전 조건
   - 단계별 실행 방법
   - 구체적인 예상 결과
   - 검증 가능한 기준

**출력 형식 (JSON):**
\`\`\`json
{
  "thinking": "명세서 분석 결과와 테스트케이스 생성 전략 설명",
  "testCases": [
    {
      "title": "테스트케이스 제목",
      "description": "테스트 목적과 검증 내용",
      "preconditions": "구체적인 사전 조건",
      "steps": [
        "1. 첫 번째 실행 단계",
        "2. 두 번째 실행 단계",
        "3. 세 번째 실행 단계"
      ],
      "expectedResult": "구체적이고 검증 가능한 예상 결과",
      "priority": "high|medium|low",
      "category": "functional|ui|error|boundary|performance",
      "relatedUserStory": "관련 사용자 스토리 ID (있는 경우)",
      "relatedScenario": "관련 시나리오 ID (있는 경우)"
    }
  ]
}
\`\`\`

**중요 사항:**
- 명세서에 명시된 내용만을 기반으로 테스트케이스 생성
- 추측이나 가정 없이 문서화된 요구사항만 활용
- 각 테스트케이스는 고유하고 중복되지 않도록 설계
- 실제 사용자가 수행할 수 있는 구체적인 단계로 작성

**언어 요구사항:**
- **모든 테스트케이스는 반드시 한국어로 작성해주세요**
- **title, description, preconditions, steps, expectedResult 모두 한국어 사용**
- **영어 단어 사용 금지 (기술 용어 제외)**
- **한국어 문장으로 자연스럽게 작성**

**출력 예시:**
\`\`\`json
{
  "title": "관리자 사이트 비밀번호 변경 성공 테스트",
  "description": "점주가 관리자 사이트에서 비밀번호를 성공적으로 변경하는 기능을 검증합니다.",
  "preconditions": "점주 계정으로 관리자 사이트에 로그인된 상태",
  "steps": [
    "1. 설정 메뉴에서 '비밀번호 변경'을 클릭합니다",
    "2. 현재 비밀번호를 입력합니다",
    "3. 새 비밀번호를 입력합니다"
  ],
  "expectedResult": "비밀번호 변경이 완료되고 성공 메시지가 표시됩니다"
}
\`\`\`

지금 즉시 위의 명세서를 기반으로 **한국어로** 체계적인 테스트케이스를 생성해주세요.`;
}

/**
 * 상세 명세서 기반 향상된 테스트케이스 프롬프트 생성
 */
function createEnhancedTestCasePrompt(detailedSpecification: string): string {
  return `당신은 QA 테스트 전문가입니다. 아래의 상세한 기능 명세서를 기반으로 **한국어로** 포괄적이고 고품질의 테스트케이스를 생성해주세요.

**중요: 모든 출력은 반드시 한국어로 작성해주세요!**

**상세 기능 명세서**:
${detailedSpecification}

**테스트케이스 생성 전략**:

1. **완전성 (Completeness)**:
   - 명세서의 모든 기능과 요구사항을 테스트로 커버
   - 숨겨진 요구사항과 암시적 기능까지 테스트 포함
   - 비즈니스 규칙과 제약조건 모두 검증

2. **다양성 (Diversity)**:
   - **정상 시나리오**: 기대되는 사용자 흐름
   - **예외 시나리오**: 오류 상황과 예외 처리
   - **경계값 테스트**: 입력값의 최소/최대 경계
   - **부정적 테스트**: 잘못된 입력과 오용 상황
   - **통합 테스트**: 다른 시스템/컴포넌트와의 연동

3. **실용성 (Practicality)**:
   - 실제 사용자가 수행할 수 있는 구체적 단계
   - 명확한 입력값과 예상 결과
   - 검증 가능한 기준과 조건

4. **우선순위 (Priority)**:
   - **High**: 핵심 비즈니스 기능, 보안 관련
   - **Medium**: 일반적 기능, 사용성
   - **Low**: 부가 기능, 성능 최적화

**생성 목표**:
- **최소 15-20개의 테스트케이스** 생성
- **각 테스트케이스는 고유하고 중복되지 않음**
- **명세서의 모든 섹션을 균형있게 커버**

**출력 형식 (JSON) - 반드시 한국어로**:
\`\`\`json
{
  "thinking": "명세서 분석 결과와 테스트케이스 생성 전략을 한국어로 상세히 설명",
  "testCases": [
    {
      "title": "구체적이고 명확한 한국어 테스트케이스 제목",
      "description": "테스트의 목적과 검증하고자 하는 내용을 한국어로 상세히 설명",
      "preconditions": "테스트 실행 전 필요한 구체적인 사전 조건들",
      "steps": [
        "1. 첫 번째 실행 단계를 구체적으로 설명",
        "2. 두 번째 실행 단계를 구체적으로 설명",
        "3. 세 번째 실행 단계를 구체적으로 설명"
      ],
      "expectedResult": "구체적이고 검증 가능한 예상 결과",
      "priority": "high|medium|low",
      "category": "functional|ui|integration|boundary|negative|performance",
      "testData": "필요한 경우 구체적인 테스트 데이터"
    }
  ]
}
\`\`\`

**예시 (비밀번호 변경 기능)**:
\`\`\`json
{
  "title": "관리자 사이트 비밀번호 정책 준수 검증 테스트",
  "description": "새 비밀번호가 설정된 정책(길이, 복잡성 등)을 만족하는지 검증합니다",
  "preconditions": "관리자 계정으로 로그인된 상태, 비밀번호 정책이 설정된 상태",
  "steps": [
    "1. 비밀번호 변경 페이지로 이동합니다",
    "2. 현재 비밀번호를 입력합니다", 
    "3. 정책을 만족하는 새 비밀번호를 입력합니다 (예: Test123!@#)",
    "4. 비밀번호 확인란에 동일한 값을 입력합니다",
    "5. 저장 버튼을 클릭합니다"
  ],
  "expectedResult": "비밀번호 변경이 성공적으로 완료되고 성공 메시지가 표시됩니다",
  "priority": "high",
  "category": "functional"
}
\`\`\`

**중요 지침**:
- 명세서에 명시된 내용만을 기반으로 테스트케이스 생성
- 추측하지 말고 문서화된 요구사항만 활용
- 각 테스트케이스는 독립적으로 실행 가능해야 함
- 실제 업무 환경에서 발생할 수 있는 시나리오 우선

지금 즉시 상세한 명세서를 철저히 분석하여 **한국어로** 고품질 테스트케이스를 생성해주세요.`;
}

// 기존 프롬프트 함수 (Fallback용)
function createAIPrompt(extractedText: string, imageAnalysis: string = ''): string {
  const combinedContent = imageAnalysis
    ? `${extractedText}\n\n=== 이미지 분석 결과 ===\n${imageAnalysis}`
    : extractedText;

  return `당신은 QA 테스트 전문가입니다. 다음 문서를 분석하여 **한국어로** 테스트 케이스를 생성해주세요.

**중요: 모든 출력은 반드시 한국어로 작성해주세요!**

**테스트 케이스 생성 원칙**:
✅ **문서 기반 테스트**: 문서에서 언급된 기능, 요구사항, 절차에 대한 테스트만 생성
✅ **실제 명시된 내용**: 문서에서 구체적으로 설명된 동작, 화면, 데이터에 대한 검증
✅ **문서 범위 준수**: 문서가 다루는 범위 내에서만 테스트 케이스 생성

**예시**:
- 문서에 "동의 버튼"이 언급되면 → 동의 버튼 테스트 포함 ✅
- 문서에 "데이터 저장"이 언급되면 → 데이터 저장 테스트 포함 ✅
- 문서에 언급이 없으면 → 해당 기능 테스트 제외 ❌

**주의사항**:
⚠️ 문서에 없는 기능은 추측하여 추가하지 마세요
⚠️ 문서가 단순하면 테스트도 단순하게 생성하세요

**문서 내용**:
${combinedContent}

**생성 규칙**:
1. 문서에서 언급된 구체적인 기능과 시나리오만 포함
2. 각 테스트 케이스는 실제 사용자가 수행할 수 있는 작업이어야 함
3. 문서의 내용과 직접적으로 관련된 테스트만 생성
4. 문서에 명시된 옵션, 설정, 기능 변경 사항을 중심으로 테스트 케이스 작성
5. **최소 8-12개의 다양한 테스트 케이스를 생성하세요**
6. **정상 시나리오, 오류 시나리오, 경계값 테스트를 모두 포함하세요**
7. **UI 테스트, 기능 테스트, 통합 테스트를 다양하게 생성하세요**
8. **중복되지 않는 고유한 테스트 케이스만 생성하세요**
9. **각 테스트 케이스는 서로 다른 관점이나 시나리오를 다뤄야 합니다**
10. **동일한 기능이라도 다른 조건, 입력값, 상황으로 구분하세요**

**JSON 형식으로 응답 (반드시 한국어로)**:
{
  "thinking": "문서 분석 과정과 테스트 케이스 생성 근거를 한국어로 설명",
  "testCases": [
    {
      "title": "관리자 사이트 비밀번호 변경 성공 테스트",
      "description": "점주가 관리자 사이트에서 비밀번호를 성공적으로 변경하는 기능을 검증합니다",
      "preconditions": "점주 계정으로 관리자 사이트에 로그인된 상태",
      "steps": [
        "1. 설정 메뉴에서 비밀번호 변경을 선택합니다",
        "2. 현재 비밀번호를 입력합니다",
        "3. 새 비밀번호를 입력합니다",
        "4. 저장 버튼을 클릭합니다"
      ],
      "expectedResult": "비밀번호 변경이 완료되고 성공 메시지가 표시됩니다",
      "priority": "high",
      "category": "functional"
    }
  ]
}

**다시 한번 강조: 모든 필드를 한국어로 작성하고, 문서 내용을 정확히 반영한 테스트 케이스를 생성해주세요.**`;
}

async function callOllama(prompt: string): Promise<any> {
  try {
    console.log('Ollama API 호출 시작');
    console.log('프롬프트 길이:', prompt.length);

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
    console.log('🔍 2단계 Ollama 응답 미리보기 (처음 1000자):');
    console.log(`"${data.response?.substring(0, 1000)}..."`);
    console.log('🔍 2단계 Ollama 응답 끝부분 (마지막 500자):');
    console.log(`"...${data.response?.substring(Math.max(0, (data.response?.length || 0) - 500))}"`);

    if (!data.response) {
      throw new Error('Ollama에서 응답을 받지 못했습니다.');
    }

    // JSON 파싱 시도 - 개선된 로직
    try {
      // 1차 시도: 전체 JSON 매칭
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        console.log('🔍 JSON 파싱 1차 시도 - 원본 JSON 길이:', jsonStr.length);

        try {
          const parsedData = JSON.parse(jsonStr);
          console.log('✅ JSON 파싱 성공 (1차)');
          return parsedData;
        } catch (firstError) {
          console.log('❌ 1차 JSON 파싱 실패:', (firstError as Error).message);

          // 2차 시도: testCases 배열만 추출
          const testCasesMatch = data.response.match(/"testCases"\s*:\s*\[([\s\S]*?)\]/);
          if (testCasesMatch) {
            console.log('🔍 JSON 파싱 2차 시도 - testCases 배열 직접 추출');
            try {
              const testCasesStr = `[${testCasesMatch[1]}]`;
              const testCasesArray = JSON.parse(testCasesStr);
              console.log('✅ testCases 배열 파싱 성공 (2차)');
              return { testCases: testCasesArray };
            } catch (secondError) {
              console.log('❌ 2차 JSON 파싱도 실패:', (secondError as Error).message);
            }
          }

          // 3차 시도: 각 테스트케이스를 개별적으로 추출
          console.log('🔍 JSON 파싱 3차 시도 - 개별 테스트케이스 추출');
          const individualCases = [];
          const caseMatches = data.response.match(/\{\s*"title"[\s\S]*?"category"[^}]*\}/g);
          if (caseMatches && caseMatches.length > 0) {
            console.log(`발견된 개별 케이스 수: ${caseMatches.length}`);
            for (let i = 0; i < caseMatches.length; i++) {
              try {
                const caseData = JSON.parse(caseMatches[i]);
                individualCases.push(caseData);
              } catch (caseError) {
                console.log(`케이스 ${i + 1} 파싱 실패:`, (caseError as Error).message);
              }
            }
            if (individualCases.length > 0) {
              console.log(`✅ 개별 추출 성공: ${individualCases.length}개 케이스`);
              return { testCases: individualCases };
            }
          }
        }
      }

      console.log('❌ 모든 JSON 파싱 시도 실패, thinking 필드에서 추출 시도');
      return createTestCasesFromThinking(data.response);

    } catch (parseError) {
      console.log('❌ JSON 파싱 전체 실패, thinking 필드에서 추출 시도:', (parseError as Error).message);
      return createTestCasesFromThinking(data.response);
    }

  } catch (error) {
    console.error('Ollama API 호출 실패:', error);
    return createTestCasesFromThinking('');
  }
}

// thinking 내용에서 테스트 케이스 생성 (fallback)
function createTestCasesFromThinking(thinkingContent: string): any {
  console.log('thinking 내용에서 테스트 케이스 생성 시작');

  // 문서 내용 기반 동적 키워드 생성
  const documentKeywords = [];

  // thinking 내용에서 키워드 추출
  if (thinkingContent.includes('개인정보') || thinkingContent.includes('동의')) {
    documentKeywords.push('개인정보 수집 동의', '동의 철회', '개인정보 처리 확인', '제3자 제공 동의', '필수 동의 확인', '선택 동의 처리');
  } else if (thinkingContent.includes('로그인') || thinkingContent.includes('인증')) {
    documentKeywords.push('로그인 시도', '인증 처리', '권한 확인', '세션 관리', '로그아웃', '비밀번호 확인');
  } else if (thinkingContent.includes('업로드') || thinkingContent.includes('파일')) {
    documentKeywords.push('파일 업로드', '파일 검증', '파일 처리', '업로드 완료', '파일 오류', '파일 삭제');
  } else {
    // 일반적인 키워드 사용
    documentKeywords.push('기본 실행', '설정 변경', '기능 테스트', '오류 처리', '정상 동작', '경계값 테스트');
  }

  console.log('생성된 문서 키워드:', documentKeywords);

  // 더 많은 테스트케이스 생성 (최대 6개)
  const testCases = [];
  const maxCases = Math.min(documentKeywords.length, 6);

  for (let i = 0; i < maxCases; i++) {
    const keyword = documentKeywords[i];
    const priority = i < 2 ? "high" : i < 4 ? "medium" : "low";

    testCases.push({
      title: `${keyword} 테스트`,
      description: `${keyword} 기능을 검증합니다.`,
      preconditions: `시스템 환경이 준비되어 있어야 합니다.`,
      steps: [
        `1. 시스템에 접근합니다.`,
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
    thinking: `문서 내용을 기반으로 테스트 케이스를 생성합니다. AI 타임아웃으로 인한 fallback 실행.`,
    testCases: testCases
  };
}

export async function POST(request: NextRequest) {
  const progressTracker = new ProgressTracker();

  try {
    console.log('=== API 호출 시작 ===');
    progressTracker.logStep('INIT', 0, 'API 호출 시작 - 파라미터 파싱 중');

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
    progressTracker.logStep('EXTRACT', 5, '파일 텍스트 추출 시작');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join('/tmp', `upload_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, buffer);

    const extractResult = await extractTextFromFile(tempFilePath, file.type, projectName, file.name);
    const extractedText = extractResult.text;
    const imageAnalysis = extractResult.imageAnalysis;

    progressTracker.logStep('EXTRACT_COMPLETE', 35, `텍스트 추출 완료 - 텍스트: ${extractedText.length}자, 이미지 분석: ${imageAnalysis.length}자`);
    console.log('- 텍스트 미리보기:', extractedText.substring(0, 200));

    // 3. Spec Kit 명세서 생성
    progressTracker.logStep('AI_SPEC', 40, 'AI 명세화 전문가 시작 - 상세 명세서 생성 중');
    let aiResult;
    let testCases = [];
    let specKitUsed = false;

    try {
      // 🔍 1단계: AI 명세화 전문가로 상세 명세서 생성
      const detailedSpec = await createDetailedSpecificationWithAI(extractedText, imageAnalysis);

      // 🤖 2단계: 상세 명세서 기반 테스트케이스 생성
      progressTracker.logStep('AI_TESTCASE', 65, '2단계 AI 테스트케이스 생성 중 - 명세서 기반 처리');
      console.log('📄 2단계 입력 데이터:');
      console.log(`- 명세서 길이: ${detailedSpec.length}자`);
      console.log(`- 명세서 미리보기 (처음 800자):`);
      console.log(`"${detailedSpec.substring(0, 800)}..."`);

      const enhancedPrompt = createEnhancedTestCasePrompt(detailedSpec);
      console.log(`- 생성된 프롬프트 길이: ${enhancedPrompt.length}자`);

      aiResult = await callOllama(enhancedPrompt);
      testCases = aiResult?.testCases || [];
      specKitUsed = true;

      progressTracker.logStep('AI_COMPLETE', 85, `AI 처리 완료 - ${testCases.length}개 테스트케이스 생성됨`);
      console.log('- 명세서 길이:', detailedSpec.length);

    } catch (specKitError) {
      console.error('❌ Spec Kit 하이브리드 방식 실패:', specKitError);
      console.log('🔄 기존 방식으로 fallback...');

      // Fallback: 기존 방식 사용
      const aiPrompt = createAIPrompt(extractedText, imageAnalysis);
      aiResult = await callOllama(aiPrompt);
      testCases = aiResult?.testCases || [];
      specKitUsed = false;

      console.log('✅ 기존 방식 Fallback 완료');
      console.log('- 생성된 테스트케이스 수:', testCases.length);
    }

    // 임시 파일 정리
    try {
      await fs.promises.unlink(tempFilePath);
      console.log('임시 파일 삭제 완료');
    } catch (unlinkError) {
      console.log('임시 파일 삭제 실패 (무시):', (unlinkError as Error).message);
    }

    // 3. 데이터베이스에 저장
    progressTracker.logStep('DATABASE', 90, '데이터베이스 저장 시작');
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
    progressTracker.logStep('COMPLETE', 100, `처리 완료 - ${savedCases.length}개 테스트케이스 저장됨`);

    // 성능 메트릭 출력
    const totalDuration = progressTracker.getTotalDuration();
    const minutes = Math.floor(totalDuration / 60000);
    const seconds = Math.floor((totalDuration % 60000) / 1000);

    console.log('📊 === 처리 완료 성능 메트릭 ===');
    console.log(`⏱️ 총 처리시간: ${minutes}분 ${seconds}초`);
    console.log(`📋 생성된 테스트케이스: ${savedCases.length}개`);
    console.log(`🔄 사용된 방식: ${specKitUsed ? '2단계 AI 방식' : '기존 방식'}`);
    console.log('📈 단계별 소요시간:');

    const progressSteps = progressTracker.getProgress();
    for (let i = 0; i < progressSteps.length; i++) {
      const step = progressSteps[i];
      if (step.duration && step.duration > 0) {
        console.log(`  - ${step.step}: ${Math.round(step.duration / 1000)}초`);
      }
    }

    // 4. 성공 응답 (프론트엔드가 기대하는 형식으로)
    const responseMessage = specKitUsed
      ? `🚀 2단계 AI 명세화 방식으로 ${savedCases.length}개의 고품질 테스트케이스가 생성되었습니다! (${minutes}분 ${seconds}초 소요)`
      : `${savedCases.length}개의 테스트 케이스가 생성되었습니다. (${minutes}분 ${seconds}초 소요)`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      generatedCount: savedCases.length, // 프론트엔드에서 사용하는 필드
      specKitUsed: specKitUsed, // Spec Kit 사용 여부
      performance: {
        totalDuration: totalDuration,
        totalMinutes: minutes,
        totalSeconds: seconds,
        steps: progressSteps.length,
        generatedCases: savedCases.length,
        progressSteps: progressSteps
      },
      data: {
        testCases: savedCases,
        projectName: projectName,
        method: specKitUsed ? 'spec-kit-hybrid' : 'traditional'
      }
    });

  } catch (error) {
    console.error('=== API 오류 ===', error);
    return NextResponse.json(
      {
        success: false,
        error: '테스트 케이스 생성 중 오류가 발생했습니다.',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
