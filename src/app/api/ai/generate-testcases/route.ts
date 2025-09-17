import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import { progressStore } from '@/lib/progress-store';

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
  private taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
  }

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

    // 진행률 저장소에 업데이트
    progressStore.updateProgress(this.taskId, step, progress, message);
  }

  setComplete(result: any) {
    progressStore.setComplete(this.taskId, result);
  }

  setError(error: string) {
    progressStore.setError(this.taskId, error);
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

  getTaskId() {
    return this.taskId;
  }
}

/**
 * AI 기반 페이지 분류 - 메타데이터 페이지 vs 기능 페이지 구분
 */
async function classifyPageWithAI(
  pageNumber: number,
  pageContent: string,
  projectName: string,
  abortSignal?: AbortSignal
): Promise<{
  classification: 'metadata' | 'functional' | 'mixed';
  confidence: number;
  reason: string;
  shouldSkip: boolean;
}> {
  console.log(`🔍 페이지 ${pageNumber} AI 분류 분석 시작...`);

  const classificationPrompt = `당신은 문서 페이지 분류 전문가입니다.
다음 페이지 내용을 분석하여 이 페이지가 테스트케이스 생성에 적합한지 판단해주세요.

**페이지 ${pageNumber} 내용**:
${pageContent}

**분류 기준**:
1. **metadata (메타데이터)**: 문서 정보만 포함
   - 문서 제목, 버전, 작성일, 담당자
   - 변경 이력, 히스토리, 목차
   - 로고, 헤더, 푸터 정보
   - 승인자, 검토자 정보

2. **functional (기능)**: 실제 기능/요구사항 포함  
   - 화면 설계, UI 구성
   - 비즈니스 로직, 처리 과정
   - 사용자 시나리오, 기능 명세
   - 데이터 구조, API 명세

3. **mixed (혼합)**: 메타데이터 + 기능이 함께 있음
   - 페이지 일부는 메타데이터, 일부는 기능

**중요**: 
- 단순히 "개인정보 제3자 제공"이라는 제목만 있고 구체적인 기능 설명이 없으면 metadata
- 실제 구현해야 할 기능, 화면, 로직이 설명되어 있어야 functional
- 테스트케이스를 만들 수 있을 정도의 구체적인 내용이 있어야 functional

**출력 형식 (JSON)**:
{
  "classification": "metadata|functional|mixed",
  "confidence": 0.0-1.0,
  "reason": "분류 이유를 한국어로 설명",
  "shouldSkip": true|false,
  "keyFeatures": ["발견된 주요 기능들"],
  "metadataElements": ["발견된 메타데이터 요소들"]
}

지금 즉시 분석하여 JSON으로 응답해주세요.`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-oss:20b',
        prompt: classificationPrompt,
        stream: false,
        options: {
          temperature: 0.1, // 일관성을 위해 낮은 temperature
          top_p: 0.8,
          max_tokens: 800
        }
      }),
      signal: abortSignal // AbortSignal 추가
    });

    if (!response.ok) {
      throw new Error(`Ollama API 호출 실패: ${response.status}`);
    }

    const result = await response.json();
    const aiResponse = result.response?.trim() || '';

    console.log(`🤖 페이지 ${pageNumber} AI 분류 응답:`, aiResponse.substring(0, 300));

    // JSON 파싱 시도
    try {
      // JSON 블록 추출
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]);

        console.log(`✅ 페이지 ${pageNumber} 분류 완료: ${parsedResult.classification} (신뢰도: ${parsedResult.confidence})`);
        console.log(`📋 분류 이유: ${parsedResult.reason}`);

        return {
          classification: parsedResult.classification || 'mixed',
          confidence: parsedResult.confidence || 0.5,
          reason: parsedResult.reason || 'AI 분석 결과',
          shouldSkip: parsedResult.shouldSkip || (parsedResult.classification === 'metadata')
        };
      }
    } catch (parseError) {
      console.log(`⚠️ 페이지 ${pageNumber} JSON 파싱 실패:`, parseError);
    }

    // Fallback: 키워드 기반 간단 분류
    const metadataKeywords = ['버전', 'version', '담당자', '작성일', '날짜', 'date', 'history', '이력', '변경사항', '목차', 'contents'];
    const functionalKeywords = ['기능', '화면', '버튼', '입력', '처리', '로직', '사용자', '시나리오', 'UI', 'API'];

    const metadataCount = metadataKeywords.filter(keyword => pageContent.toLowerCase().includes(keyword.toLowerCase())).length;
    const functionalCount = functionalKeywords.filter(keyword => pageContent.toLowerCase().includes(keyword.toLowerCase())).length;

    const isMetadata = metadataCount > functionalCount && pageContent.length < 200;

    return {
      classification: isMetadata ? 'metadata' : 'mixed',
      confidence: 0.6,
      reason: `키워드 기반 분류 - 메타데이터: ${metadataCount}, 기능: ${functionalCount}`,
      shouldSkip: isMetadata
    };

  } catch (error) {
    console.error(`❌ 페이지 ${pageNumber} 분류 실패:`, error);
    return {
      classification: 'mixed',
      confidence: 0.3,
      reason: `분류 실패: ${(error as Error).message}`,
      shouldSkip: false // 안전하게 포함
    };
  }
}

/**
 * 페이지별 개별 AI 명세화 - 각 페이지를 독립적으로 분석
 */
async function createPageSpecificationWithAI(
  pageNumber: number,
  pageContent: string,
  projectName: string,
  abortSignal?: AbortSignal
): Promise<string> {
  console.log(`🔍 페이지 ${pageNumber} 개별 AI 명세화 시작...`);
  console.log(`- 페이지 ${pageNumber} 내용 길이: ${pageContent.length}자`);

  const pageSpecPrompt = `당신은 첨부 문서의 페이지별 분석 전문가입니다.
다음은 PDF 파일의 **페이지 ${pageNumber}**에서 추출한 실제 내용입니다. 이 페이지의 내용만을 분석하여 명세서를 작성해주세요.

**페이지 ${pageNumber} 추출 내용**:
${pageContent}

**페이지별 분석 원칙**:
✅ **이 페이지에서만 확인된 내용**: 해당 페이지에서 실제로 언급된 기능, 요구사항만 포함
✅ **페이지 특화 분석**: 이 페이지의 고유한 내용과 맥락에 집중
✅ **명확한 페이지 표시**: 모든 내용 앞에 [페이지 ${pageNumber}] 표시

**출력 형식**:
## 페이지 ${pageNumber} 분석 결과

### 📋 페이지 개요
**페이지 내용**: [이 페이지에서 다루는 주요 내용]
**기능 범위**: [이 페이지에서 설명하는 기능의 범위]

### 🔍 페이지별 요구사항
#### 명시된 기능
- [이 페이지에서 직접 언급된 기능들만 나열]

#### UI/UX 요소 (해당되는 경우)
- [이 페이지에서 확인된 화면 구성, 버튼, 입력 필드 등]

#### 비즈니스 로직 (해당되는 경우)  
- [이 페이지에서 설명된 처리 과정, 규칙, 조건 등]

### 📝 테스트 포인트
- [이 페이지 내용을 기반으로 테스트해야 할 구체적인 항목들]

**주의사항**:
⚠️ 다른 페이지의 내용을 추측하거나 참조하지 마세요
⚠️ 이 페이지에 없는 내용은 "페이지에서 명시되지 않음"으로 표시
⚠️ 페이지가 단순하면 명세서도 단순하게 작성하세요`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-oss:20b',
        prompt: pageSpecPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 2000
        }
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new Error(`Ollama API 호출 실패: ${response.status}`);
    }

    const result = await response.json();
    const specification = result.response?.trim() || '';

    console.log(`✅ 페이지 ${pageNumber} 명세화 완료, 길이: ${specification.length}자`);
    console.log(`페이지 ${pageNumber} 명세서 미리보기: ${specification.substring(0, 300)}...`);

    return specification;

  } catch (error) {
    console.error(`❌ 페이지 ${pageNumber} 명세화 실패:`, error);
    return `[페이지 ${pageNumber}] 명세화 처리 실패: ${(error as Error).message}`;
  }
}

/**
 * 페이지별 명세서들을 통합하여 최종 명세서 생성
 */
async function integratePageSpecifications(
  pageSpecs: string[],
  projectName: string,
  abortSignal?: AbortSignal
): Promise<string> {
  console.log(`🔗 ${pageSpecs.length}개 페이지 명세서 통합 시작...`);

  const integrationPrompt = `당신은 문서 통합 전문가입니다.
다음은 ${projectName} 프로젝트 문서의 각 페이지별로 분석된 명세서들입니다. 이들을 통합하여 완전한 프로젝트 명세서를 작성해주세요.

**페이지별 명세서들**:
${pageSpecs.map((spec, index) => `\n--- 페이지 ${index + 1} 명세서 ---\n${spec}`).join('\n')}

**통합 원칙**:
✅ **페이지 정보 보존**: 각 요구사항이 어느 페이지에서 나온 것인지 명시
✅ **중복 제거**: 여러 페이지에서 중복된 내용은 통합하되 페이지 정보는 보존
✅ **논리적 구조**: 페이지 순서를 고려한 논리적인 흐름으로 재구성
✅ **완전성**: 모든 페이지의 내용이 누락되지 않도록 보장

**출력 형식**:
## ${projectName} 프로젝트 통합 명세서

### 📖 문서 개요
**총 페이지 수**: ${pageSpecs.length}페이지
**문서 범위**: [전체 문서가 다루는 기능 범위]

### 🎯 통합 요구사항
#### 핵심 기능
- [페이지 X] 기능명: 설명
- [페이지 Y] 기능명: 설명

#### UI/UX 통합
- [페이지 X,Y] 화면 구성: 설명

#### 비즈니스 로직 통합  
- [페이지 X] 처리 과정: 설명

### 📋 페이지별 상세 내용
${pageSpecs.map((spec, index) => `#### 페이지 ${index + 1} 상세\n${spec}`).join('\n\n')}

### 🧪 통합 테스트 전략
- [전체 흐름 테스트]: 페이지 1-${pageSpecs.length} 연계 테스트
- [개별 기능 테스트]: 각 페이지별 독립 테스트`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-oss:20b',
        prompt: integrationPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 4000
        }
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new Error(`Ollama API 호출 실패: ${response.status}`);
    }

    const result = await response.json();
    const integratedSpec = result.response?.trim() || '';

    console.log(`✅ 통합 명세서 생성 완료, 길이: ${integratedSpec.length}자`);
    console.log(`통합 명세서 미리보기: ${integratedSpec.substring(0, 500)}...`);

    return integratedSpec;

  } catch (error) {
    console.error(`❌ 명세서 통합 실패:`, error);
    // 통합 실패 시 페이지별 명세서를 단순 결합
    return pageSpecs.map((spec, index) => `=== 페이지 ${index + 1} ===\n${spec}`).join('\n\n');
  }
}

/**
 * 새로운 페이지별 AI 명세화 - 각 페이지를 독립 분석 후 통합
 */
async function createPageByPageSpecificationWithAI(
  extractedText: string,
  imageAnalysis: string,
  projectName: string,
  progressTracker: ProgressTracker,
  abortSignal: AbortSignal
): Promise<string> {
  console.log('🚀 페이지별 개별 AI 분석 시작...');

  // imageAnalysis에서 페이지별 내용 분리
  const pageContents: string[] = [];

  if (imageAnalysis && imageAnalysis.includes('[페이지')) {
    // 이미지 분석 결과를 페이지별로 분리
    const pageMatches = imageAnalysis.split(/\[페이지 \d+\]/);
    pageMatches.forEach((content, index) => {
      if (index > 0 && content.trim()) { // 첫 번째는 빈 문자열이므로 제외
        pageContents.push(content.trim());
      }
    });
  }

  // 텍스트에서도 페이지 정보가 있다면 활용
  if (extractedText && extractedText.includes('[페이지')) {
    const textPageMatches = extractedText.split(/\[페이지 \d+\]/);
    textPageMatches.forEach((content, index) => {
      if (index > 0 && content.trim()) {
        // 기존 페이지 내용과 병합
        if (pageContents[index - 1]) {
          pageContents[index - 1] += '\n\n=== 추가 텍스트 ===\n' + content.trim();
        } else {
          pageContents.push(content.trim());
        }
      }
    });
  }

  // 페이지별 내용이 분리되지 않았다면 전체 내용을 단일 페이지로 처리
  if (pageContents.length === 0) {
    console.log('📄 페이지 분리 불가 - 전체 내용을 단일 페이지로 처리');
    const combinedContent = imageAnalysis ?
      `${extractedText}\n\n=== 이미지 분석 결과 ===\n${imageAnalysis}` :
      extractedText;
    pageContents.push(combinedContent);
  }

  console.log(`📊 분석할 페이지 수: ${pageContents.length}개`);

  // 각 페이지별로 AI 분류 후 명세화 수행
  const pageSpecs: string[] = [];
  const pageClassifications: Array<{ pageNumber: number, classification: any }> = [];
  const totalPages = pageContents.length;
  let functionalPageCount = 0;

  for (let i = 0; i < totalPages; i++) {
    const pageNumber = i + 1;
    const progressPercent = 25 + Math.round((i / totalPages) * 15); // 25-40% 구간 (분류용)

    progressTracker.logStep(`CLASSIFY_${pageNumber}`, progressPercent, `페이지 ${pageNumber}/${totalPages} AI 분류 분석 중`);

    try {
      // 1단계: AI 페이지 분류
      const classification = await classifyPageWithAI(pageNumber, pageContents[i], projectName, abortSignal);
      pageClassifications.push({ pageNumber, classification });

      console.log(`🏷️ 페이지 ${pageNumber} 분류: ${classification.classification} (${classification.shouldSkip ? '제외' : '포함'})`);
      console.log(`📝 분류 이유: ${classification.reason}`);

      // 2단계: 기능 페이지만 명세화 수행
      if (!classification.shouldSkip) {
        const specProgressPercent = 40 + Math.round((functionalPageCount / totalPages) * 8); // 40-48% 구간
        progressTracker.logStep(`PAGE_${pageNumber}`, specProgressPercent, `페이지 ${pageNumber} AI 명세화 중 (${classification.classification})`);

        const pageSpec = await createPageSpecificationWithAI(pageNumber, pageContents[i], projectName, abortSignal);
        pageSpecs.push(pageSpec);
        functionalPageCount++;
        console.log(`✅ 페이지 ${pageNumber} 명세화 완료 (포함됨)`);
      } else {
        console.log(`⏭️ 페이지 ${pageNumber} 건너뛰기 (${classification.classification}: ${classification.reason})`);
        // 건너뛴 페이지도 기록은 남김 (디버깅용)
        pageSpecs.push(`[페이지 ${pageNumber}] ${classification.classification} 페이지로 분류되어 테스트케이스 생성에서 제외됨 - ${classification.reason}`);
      }

    } catch (error) {
      console.error(`❌ 페이지 ${pageNumber} 처리 실패:`, error);
      pageSpecs.push(`[페이지 ${pageNumber}] 처리 실패: ${(error as Error).message}`);
    }
  }

  console.log(`📊 페이지 분류 결과: 전체 ${totalPages}페이지 중 ${functionalPageCount}페이지가 기능 페이지로 분류됨`);
  pageClassifications.forEach(({ pageNumber, classification }) => {
    console.log(`  - 페이지 ${pageNumber}: ${classification.classification} (신뢰도: ${classification.confidence})`);
  });

  // 🚨 기능 페이지가 없는 경우 조기 종료
  if (functionalPageCount === 0) {
    console.log('🚫 기능 페이지가 없어 테스트케이스 생성을 건너뜁니다.');
    progressTracker.logStep('NO_FUNCTIONAL_PAGES', 100, '모든 페이지가 메타데이터로 분류되어 테스트케이스 생성이 불필요합니다.');

    return `## ${projectName} - 메타데이터 전용 문서

### 📋 AI 페이지 분류 결과
전체 ${totalPages}페이지가 모두 **메타데이터 페이지**로 분류되었습니다.

${pageClassifications.map(({ pageNumber, classification }) =>
      `- **페이지 ${pageNumber}**: ${classification.classification} (신뢰도: ${classification.confidence})\n  ${classification.reason}`
    ).join('\n\n')}

### 🎯 결론
이 문서는 **문서 정보, 버전 관리, 변경 이력** 등 메타데이터만 포함하고 있어, 실제 기능이나 화면에 대한 테스트케이스를 생성할 필요가 없습니다.

**권장사항**: 실제 기능 명세가 포함된 페이지가 있는 문서로 테스트케이스를 생성해주세요.`;
  }

  // 페이지별 명세서들을 통합
  progressTracker.logStep('INTEGRATE', 48, `${functionalPageCount}개 기능 페이지 명세서 통합 중`);

  try {
    // 분류 정보를 포함한 통합 명세서 생성
    const classificationSummary = pageClassifications.map(({ pageNumber, classification }) =>
      `페이지 ${pageNumber}: ${classification.classification} (${classification.shouldSkip ? '제외' : '포함'})`
    ).join('\n');

    const enhancedSpecs = [
      `## AI 페이지 분류 결과\n전체 ${totalPages}페이지 중 ${functionalPageCount}페이지가 기능 페이지로 분류되어 테스트케이스 생성에 포함됩니다.\n\n${classificationSummary}\n\n## 기능 페이지 명세서`,
      ...pageSpecs
    ];

    const integratedSpec = await integratePageSpecifications(enhancedSpecs, projectName, abortSignal);
    console.log('✅ AI 분류 기반 명세서 통합 완료');
    console.log(`📈 효율성 개선: ${totalPages - functionalPageCount}개 메타데이터 페이지 제외됨`);
    return integratedSpec;
  } catch (error) {
    console.error('❌ 명세서 통합 실패:', error);
    // 통합 실패 시 페이지별 명세서를 단순 결합
    return pageSpecs.map((spec, index) => `=== 페이지 ${index + 1} ===\n${spec}`).join('\n\n');
  }
}

/**
 * AI 기반 명세화 전문가 - PDF 내용을 상세 명세서로 변환 (기존 방식)
 */
export async function createDetailedSpecificationWithAI(
  extractedText: string,
  imageAnalysis: string,
  abortSignal?: AbortSignal
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

## 2. 페이지별 내용 분석
**페이지 1**: [1페이지에서 확인된 내용 요약]
**페이지 2**: [2페이지에서 확인된 내용 요약] 
**페이지 3**: [3페이지에서 확인된 내용 요약]
(실제 페이지 수에 맞게 조정)

## 3. 문서 정보
**버전**: [문서 버전]
**날짜**: [문서 날짜]  
**담당자**: [담당자 정보]

## 4. 문서에서 확인된 요구사항
### 4.1 명시된 기능
- [문서에서 직접 언급된 기능들만 나열]

### 4.2 변경사항 및 버전 정보
- [문서에 포함된 변경 내역, 히스토리 정보]

### 4.3 관련 정보
- [문서에 명시된 담당자, 날짜, 기타 메타데이터]

## 5. 문서 기반 사용자 시나리오
### 5.1 문서에서 추론되는 주요 흐름
[첨부 문서 내용으로부터만 추론되는 사용자 흐름]

## 6. 테스트 대상 기능
### 6.1 문서에서 확인된 테스트 포인트
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
      signal: abortSignal // AbortSignal 사용
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
  projectName: string,
  abortSignal?: AbortSignal
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
              for (const imagePath of imagePaths) { // 모든 페이지 처리
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
              const maxPages = images.length; // 모든 페이지 분석 (AI 페이지 분류 시스템으로 효율성 확보)

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
      "priority": "high|medium|low|critical",
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

**🚨 중요 지침 - 반드시 준수해주세요! 🚨**
1. **모든 출력은 반드시 한국어로 작성**
2. **영어 단어 사용 절대 금지** (Agree, Continue, Toggle 등)
3. **실제 앱 UI 용어 사용**: "동의함", "동의안함", "계속 진행", "체크박스", "버튼"
4. **페이지 번호 대신 구체적인 화면/기능 설명 사용**
5. **실제 문서 내용 기반으로만 테스트케이스 작성**

**상세 기능 명세서**:
${detailedSpecification}

**🔥 페이지 번호 처리 지침 🔥**:
- 위 명세서에서 각 기능이 언급된 페이지 번호를 확인하세요
- **pageNumbers 필드에만 페이지 번호를 기록하세요** (예: "4" 또는 "4,5,6")
- **⚠️ 중요: title, description, steps, expectedResult 등 다른 필드에서는 절대로 페이지 번호를 언급하지 마세요**
- **❌ 금지**: "페이지 4에서", "4페이지의", "page 5에서" 등의 표현 사용 금지
- **✅ 올바른 예**: title: "위치기반 서비스 이용약관 동의 기능 테스트", pageNumbers: "4"
- **❌ 잘못된 예**: title: "페이지 4의 위치기반 서비스 이용약관 동의 기능 테스트"

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
      "title": "구체적이고 명확한 한국어 테스트케이스 제목 (영어 단어 사용 금지)",
      "description": "테스트의 목적과 검증하고자 하는 내용을 한국어로 상세히 설명 (실제 화면/기능 기준)",
      "preconditions": "테스트 실행 전 필요한 구체적인 사전 조건들 (앱 상태, 로그인 여부 등)",
      "steps": [
        "1. 첫 번째 실행 단계를 구체적으로 설명 (버튼명, 메뉴명 등 실제 UI 요소 사용)",
        "2. 두 번째 실행 단계를 구체적으로 설명 (동의함/동의안함 등 한국어 용어)",
        "3. 세 번째 실행 단계를 구체적으로 설명 (계속 진행, 확인 등 실제 버튼명)"
      ],
      "expectedResult": "구체적이고 검증 가능한 예상 결과",
      "priority": "high|medium|low|critical",
      "category": "functional|ui|integration|boundary|negative|performance",
      "testData": "필요한 경우 구체적인 테스트 데이터",
      "pageNumbers": "이 테스트케이스가 나온 페이지 번호 (예: '1,2' 또는 '3')"
    }
  ]
}
\`\`\`

**좋은 테스트케이스 예시 (한국어 앱 기준)**:
\`\`\`json
{
  "title": "개인정보 제3자 제공 동의 체크박스 선택 시 계속 진행 버튼 활성화 검증",
  "description": "회원가입 화면에서 개인정보 제3자 제공 동의 체크박스를 선택했을 때 '동의하고 계속 진행' 버튼이 활성화되는지 확인합니다",
  "preconditions": "카카오VX 앱이 실행되고 회원가입 화면이 표시된 상태",
  "steps": [
    "1. 개인정보 제3자 제공 동의 체크박스를 선택합니다",
    "2. '동의하고 계속 진행' 버튼의 상태를 확인합니다",
    "3. 버튼을 클릭합니다"
  ],
  "expectedResult": "'동의하고 계속 진행' 버튼이 활성화되고 클릭 시 다음 단계로 진행됩니다",
  "priority": "high",
  "category": "functional",
  "pageNumbers": "5"
}
\`\`\`

**나쁜 예시 (절대 사용 금지)**:
❌ "페이지 3에서 위치 서비스 토글을 'Agree' 상태로..."
✅ "위치기반 서비스 이용약관 동의 화면에서 '동의함' 체크박스를 선택하여..."

❌ "'Agree & Continue' 버튼 활성화..."
✅ "'동의하고 계속 진행' 버튼 활성화..."

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

**🚨 중요 지침 - 반드시 준수해주세요! 🚨**
1. **모든 출력은 반드시 한국어로 작성**
2. **영어 단어 사용 절대 금지** (Agree, Continue, Toggle 등)
3. **실제 앱 UI 용어 사용**: "동의함", "동의안함", "계속 진행", "체크박스", "버튼"
4. **페이지 번호 대신 구체적인 화면/기능 설명 사용**
5. **실제 문서 내용 기반으로만 테스트케이스 작성**

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
11. **페이지 정보 처리 (중요)**: 
    - **pageNumbers 필드에만** 페이지 번호를 기록하세요 (예: "1", "2", "1,2")
    - **⚠️ 금지**: title, description, steps 등에서 "페이지 1에서", "1페이지의" 같은 표현 사용 금지
    - **✅ 올바른 방식**: title: "로그인 기능 테스트", pageNumbers: "3"
    - **❌ 잘못된 방식**: title: "페이지 3의 로그인 기능 테스트"

**JSON 형식으로 응답 (반드시 한국어로)**:
{
  "thinking": "문서의 각 페이지별 내용을 분석하고, 각 테스트케이스가 어느 페이지에서 나온 것인지 설명하세요",
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

async function callOllama(prompt: string, abortSignal?: AbortSignal): Promise<any> {
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
          num_ctx: 8192, // 컨텍스트 크기 증가
        }
      }),
      signal: abortSignal, // AbortSignal 사용
      // 타임아웃 설정 추가 (5분)
      timeout: 300000
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
    console.error('에러 타입:', error.constructor.name);
    console.error('에러 메시지:', error.message);

    // 타임아웃 에러인 경우 더 자세한 로그
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      console.error('🕐 Ollama 타임아웃 발생 - 모델이 응답하는데 시간이 너무 오래 걸립니다.');
      console.error('💡 해결 방법: 1) 더 작은 모델 사용, 2) 프롬프트 길이 줄이기, 3) Ollama 서버 재시작');
    }

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
  // AbortSignal을 통한 요청 취소 감지
  const abortSignal = request.signal;

  // 중단 여부 체크 헬퍼 함수
  const checkAborted = () => {
    if (abortSignal.aborted) {
      throw new Error('Request aborted by client');
    }
  };

  // 고유한 작업 ID 생성
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const progressTracker = new ProgressTracker(taskId);

  try {
    console.log('=== API 호출 시작 ===');
    console.log(`📋 작업 ID: ${taskId}`);
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

    // 🚀 즉시 taskId 반환 - 동기 처리로 복원
    console.log(`🔄 동기 처리 방식으로 복원: ${taskId}`);

    // 초기 진행률을 즉시 등록
    progressTracker.logStep('INIT_COMPLETE', 2, '테스트케이스 생성 시작됨 - 파일 처리 시작');
    checkAborted(); // 중단 체크

    // 실제 처리 시작 (동기적으로)
    const result = await processTestCaseGeneration(file, projectId, projectName, progressTracker, taskId, checkAborted, abortSignal);

    // 완료 후 결과 반환
    return NextResponse.json({
      success: true,
      taskId: taskId,
      ...result
    });

  } catch (error) {
    console.error('=== API 초기화 오류 ===', error);
    const errorMessage = (error as Error).message;

    // AbortError 처리
    if (errorMessage === 'Request aborted by client') {
      console.log('✅ 클라이언트가 요청을 중단했습니다:', taskId);
      progressStore.setError(taskId, '클라이언트가 요청을 중단했습니다.');

      return NextResponse.json(
        {
          success: false,
          error: '요청이 중단되었습니다.',
          taskId: taskId,
          aborted: true
        },
        { status: 499 } // Client Closed Request
      );
    }

    progressTracker.setError(errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: '테스트 케이스 생성 초기화 중 오류가 발생했습니다.',
        details: errorMessage,
        taskId: taskId
      },
      { status: 500 }
    );
  }
}

// 백그라운드에서 실제 테스트케이스 생성 처리
async function processTestCaseGeneration(
  file: File,
  projectId: string,
  projectName: string,
  progressTracker: ProgressTracker,
  taskId: string,
  checkAborted: () => void,
  abortSignal: AbortSignal
) {
  try {
    console.log(`🚀 백그라운드 처리 시작: ${taskId}`);

    // 2. 파일에서 텍스트 추출
    progressTracker.logStep('EXTRACT', 5, '파일 텍스트 추출 시작');
    checkAborted(); // 중단 체크
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join('/tmp', `upload_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, buffer);

    const extractResult = await extractTextFromFile(tempFilePath, file.type, projectName, file.name);
    const extractedText = extractResult.text;
    const imageAnalysis = extractResult.imageAnalysis;

    progressTracker.logStep('EXTRACT_COMPLETE', 20, `텍스트 추출 완료 - 텍스트: ${extractedText.length}자, 이미지 분석: ${imageAnalysis.length}자`);
    console.log('- 텍스트 미리보기:', extractedText.substring(0, 200));

    // 3. Spec Kit 명세서 생성
    progressTracker.logStep('AI_SPEC', 25, 'AI 명세화 전문가 시작 - 상세 명세서 생성 중');
    checkAborted(); // 중단 체크
    let aiResult;
    let testCases = [];
    let specKitUsed = false;

    try {
      // 🚀 1단계: 페이지별 개별 AI 명세화 (새로운 방식)
      console.log('🆕 페이지별 개별 AI 분석 방식 사용');
      const detailedSpec = await createPageByPageSpecificationWithAI(extractedText, imageAnalysis, projectName, progressTracker, abortSignal);

      // 🚨 메타데이터 전용 문서 체크 (기능 페이지 없음)
      if (detailedSpec.includes('메타데이터 전용 문서') && detailedSpec.includes('테스트케이스를 생성할 필요가 없습니다')) {
        console.log('🚫 메타데이터 전용 문서로 판단 - 테스트케이스 생성 건너뜀');

        // 빈 테스트케이스로 성공 응답 처리
        testCases = [];
        specKitUsed = true;

        progressTracker.logStep('METADATA_ONLY', 100, '메타데이터 전용 문서 - 테스트케이스 생성 불필요');
      } else {
        // 🤖 2단계: AI 분류 기반 통합 명세서로 테스트케이스 생성
        progressTracker.logStep('SPEC_COMPLETE', 50, '📋 명세화 단계 완료 - 테스트케이스 생성 시작');
        progressTracker.logStep('AI_TESTCASE', 55, 'AI 분류 완료 - 기능 페이지 기반 테스트케이스 생성 중');
        console.log('📄 2단계 입력 데이터:');
        console.log(`- 명세서 길이: ${detailedSpec.length}자`);
        console.log(`- 명세서 미리보기 (처음 800자):`);
        console.log(`"${detailedSpec.substring(0, 800)}..."`);

        const enhancedPrompt = createEnhancedTestCasePrompt(detailedSpec);
        console.log(`- 생성된 프롬프트 길이: ${enhancedPrompt.length}자`);

        aiResult = await callOllama(enhancedPrompt, abortSignal);
        testCases = aiResult?.testCases || [];
        specKitUsed = true;

        progressTracker.logStep('AI_COMPLETE', 85, `AI 분류 기반 처리 완료 - ${testCases.length}개 테스트케이스 생성됨`);
        console.log('- 명세서 길이:', detailedSpec.length);
      }

    } catch (specKitError) {
      console.error('❌ Spec Kit 하이브리드 방식 실패:', specKitError);
      console.log('🔄 기존 방식으로 fallback...');

      // Fallback: 기존 방식 사용
      progressTracker.logStep('SPEC_COMPLETE', 50, '📋 명세화 단계 완료 - 테스트케이스 생성 시작 (Fallback 방식)');
      progressTracker.logStep('AI_FALLBACK', 55, '기존 방식으로 테스트케이스 생성 중');
      const aiPrompt = createAIPrompt(extractedText, imageAnalysis);
      aiResult = await callOllama(aiPrompt, abortSignal);
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

    let savedCases = [];

    // 🚨 메타데이터 전용 문서인 경우 데이터베이스 저장 건너뛰기
    if (testCases.length === 0) {
      console.log('🚫 메타데이터 전용 문서 - 데이터베이스 저장 건너뛰기');
      progressTracker.logStep('COMPLETE', 100, '메타데이터 전용 문서 처리 완료 - 테스트케이스 생성 불필요');
    } else {
      // 일반적인 데이터베이스 저장 처리
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
          test_strategy, expected_result, priority, status, created_by, category_id, page_numbers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const testCase of testCases) {
        try {
          // description에서 페이지 명시 제거
          const cleanDescription = (testCase.description || '')
            .replace(/페이지\s*\d+[^\s]*\s*/g, '') // "페이지1", "페이지 3" 등 제거
            .replace(/page\s*\d+[^\s]*\s*/gi, '') // "page 1", "Page 3" 등 제거
            .trim();

          // steps를 문자열로 변환 (확인방법 컬럼용)
          const stepsText = Array.isArray(testCase.steps)
            ? testCase.steps.join('\n')
            : (testCase.steps || '확인 방법 없음');

          // 프론트엔드가 기대하는 description 형식으로 조합
          const formattedDescription = `${cleanDescription}

사전 조건: ${testCase.preconditions || '사전 조건 없음'}

확인 방법: ${stepsText}

기대 결과: ${testCase.expectedResult || testCase.expected_result || '기대 결과 없음'}`;

          // pageNumbers에서 실제 페이지 번호만 추출 (4,5,6,7,12,14 형태로)
          let cleanPageNumbers = '';
          if (testCase.pageNumbers) {
            // 숫자만 추출해서 콤마로 연결
            const numbers = testCase.pageNumbers.toString().match(/\d+/g);
            if (numbers && numbers.length > 0) {
              cleanPageNumbers = numbers.join(',');
            }
          }

          // Priority 값을 DB 허용 값으로 매핑
          const priorityMap: { [key: string]: string } = {
            '상': 'high',
            '높음': 'high',
            'high': 'high',
            '높은': 'high',
            '긴급': 'critical',
            'critical': 'critical',
            'urgent': 'critical',
            '중': 'medium',
            '보통': 'medium',
            'medium': 'medium',
            '일반': 'medium',
            'normal': 'medium',
            '하': 'low',
            '낮음': 'low',
            'low': 'low',
            '낮은': 'low'
          };

          const rawPriority = (testCase.priority || 'medium').toString().toLowerCase();
          const dbPriority = priorityMap[rawPriority] || 'medium';
          console.log(`Priority 매핑: ${testCase.priority} -> ${dbPriority}`);

          const result = insertStmt.run(
            parseInt(projectId),
            testCase.title || '제목 없음',
            formattedDescription, // 전체 형식이 포함된 description 저장 (파싱용)
            '', // preconditions는 저장하지 않음
            stepsText, // 확인방법을 test_strategy 필드에 저장
            testCase.expectedResult || testCase.expected_result || '기대 결과 없음',
            dbPriority,
            'not_run',
            1, // created_by: 기본 사용자 ID
            1, // category_id: 기능테스트
            cleanPageNumbers // 실제 페이지 번호만 저장 (예: "4,5,6")
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
      progressTracker.logStep('COMPLETE', 100, `🎉 처리 완료 - ${savedCases.length}개 테스트케이스 저장됨`);
    }

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
    let responseMessage;
    if (savedCases.length === 0) {
      responseMessage = `🚫 메타데이터 전용 문서로 판단되어 테스트케이스를 생성하지 않았습니다. 실제 기능이나 화면 명세가 포함된 문서를 업로드해주세요. (${minutes}분 ${seconds}초 소요)`;
    } else {
      responseMessage = specKitUsed
        ? `🤖 AI 페이지 분류 + 기능 페이지 집중 분석으로 ${savedCases.length}개의 고품질 테스트케이스가 생성되었습니다! (${minutes}분 ${seconds}초 소요)`
        : `${savedCases.length}개의 테스트 케이스가 생성되었습니다. (${minutes}분 ${seconds}초 소요)`;
    }

    // 완료 처리
    const result = {
      success: true,
      message: responseMessage,
      generatedCount: savedCases.length,
      specKitUsed: specKitUsed,
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
        method: specKitUsed ? 'ai-page-classification' : 'traditional'
      }
    };

    progressTracker.setComplete(result);
    console.log(`✅ 처리 완료: ${taskId} - ${savedCases.length}개 테스트케이스 생성`);

    return result;

  } catch (error) {
    console.error(`❌ 처리 실패: ${taskId}`, error);
    const errorMessage = (error as Error).message;
    progressTracker.setError(errorMessage);
    throw error;
  }
}
