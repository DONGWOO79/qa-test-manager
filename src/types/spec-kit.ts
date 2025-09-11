/**
 * QA 테스트 관리 시스템을 위한 Spec Kit 타입 정의
 * GitHub Spec Kit의 구조를 QA 테스트케이스 생성에 최적화
 */

export interface SpecKitSpecification {
    // 기본 정보
    id: string;
    title: string;
    version: string;
    created_at: string;
    updated_at: string;

    // 1. 기능 명세 (Functionality Specification)
    functionality: {
        overview: string;           // 전체 기능 개요
        purpose: string;           // 기능의 목적
        scope: string[];           // 기능 범위
        userStories: UserStory[];  // 사용자 스토리
        businessRules: string[];   // 비즈니스 규칙
    };

    // 2. 기술 요구사항 (Technical Requirements)
    technical: {
        architecture: string[];    // 아키텍처 요구사항
        technologies: string[];    // 사용 기술
        integrations: string[];    // 외부 연동
        performance: PerformanceRequirement[];  // 성능 요구사항
        security: SecurityRequirement[];       // 보안 요구사항
    };

    // 3. 사용자 시나리오 (User Scenarios)
    scenarios: {
        primary: Scenario[];       // 주요 시나리오
        alternative: Scenario[];   // 대안 시나리오
        exception: Scenario[];     // 예외 시나리오
        edge: Scenario[];         // 경계값 시나리오
    };

    // 4. 제약 조건 (Constraints)
    constraints: {
        functional: string[];      // 기능적 제약
        technical: string[];       // 기술적 제약
        business: string[];        // 비즈니스 제약
        regulatory: string[];      // 규제/정책 제약
    };

    // 5. 수용 기준 (Acceptance Criteria)
    acceptance: {
        functional: AcceptanceCriteria[];  // 기능 수용 기준
        performance: AcceptanceCriteria[]; // 성능 수용 기준
        usability: AcceptanceCriteria[];   // 사용성 수용 기준
        security: AcceptanceCriteria[];    // 보안 수용 기준
    };

    // 6. 테스트 전략 (Test Strategy)
    testStrategy: {
        approach: TestApproach[];          // 테스트 접근법
        coverage: TestCoverage[];          // 테스트 커버리지
        priorities: TestPriority[];        // 테스트 우선순위
        risks: TestRisk[];                 // 테스트 리스크
    };
}

// 사용자 스토리
export interface UserStory {
    id: string;
    as: string;           // 사용자 역할 (As a...)
    want: string;         // 원하는 것 (I want...)
    so: string;          // 목적 (So that...)
    priority: 'high' | 'medium' | 'low';
    acceptanceCriteria: string[];
}

// 시나리오
export interface Scenario {
    id: string;
    title: string;
    description: string;
    preconditions: string[];   // 사전 조건
    steps: ScenarioStep[];     // 시나리오 단계
    expectedResults: string[]; // 예상 결과
    postconditions: string[];  // 사후 조건
    priority: 'high' | 'medium' | 'low';
    complexity: 'simple' | 'moderate' | 'complex';
}

// 시나리오 단계
export interface ScenarioStep {
    stepNumber: number;
    action: string;
    data?: string;
    expectedResult?: string;
}

// 성능 요구사항
export interface PerformanceRequirement {
    metric: string;        // 성능 지표 (응답시간, 처리량 등)
    target: string;        // 목표 값
    condition: string;     // 조건
    priority: 'high' | 'medium' | 'low';
}

// 보안 요구사항
export interface SecurityRequirement {
    category: 'authentication' | 'authorization' | 'data_protection' | 'communication' | 'audit';
    requirement: string;
    implementation: string;
    priority: 'high' | 'medium' | 'low';
}

// 수용 기준
export interface AcceptanceCriteria {
    id: string;
    criterion: string;
    measurable: boolean;
    testable: boolean;
    priority: 'high' | 'medium' | 'low';
}

// 테스트 접근법
export interface TestApproach {
    type: 'unit' | 'integration' | 'system' | 'acceptance' | 'performance' | 'security' | 'usability';
    description: string;
    tools: string[];
    coverage: number; // 커버리지 목표 (%)
}

// 테스트 커버리지
export interface TestCoverage {
    area: string;          // 커버리지 영역
    target: number;        // 목표 커버리지 (%)
    current?: number;      // 현재 커버리지 (%)
    priority: 'high' | 'medium' | 'low';
}

// 테스트 우선순위
export interface TestPriority {
    feature: string;
    priority: 'high' | 'medium' | 'low';
    rationale: string;     // 우선순위 근거
    riskLevel: 'high' | 'medium' | 'low';
}

// 테스트 리스크
export interface TestRisk {
    risk: string;
    impact: 'high' | 'medium' | 'low';
    probability: 'high' | 'medium' | 'low';
    mitigation: string;    // 완화 방안
}

// PDF에서 추출된 원본 데이터
export interface ExtractedContent {
    text: string;
    images?: string[];     // Base64 이미지들
    metadata?: {
        pages: number;
        title?: string;
        author?: string;
        createdDate?: string;
    };
}

// Spec Kit 생성 결과
export interface SpecKitGenerationResult {
    specification: SpecKitSpecification;
    confidence: number;    // 생성 신뢰도 (0-1)
    warnings: string[];    // 경고 메시지
    suggestions: string[]; // 개선 제안
}

// 테스트케이스 생성 컨텍스트
export interface TestCaseGenerationContext {
    specification: SpecKitSpecification;
    projectInfo: {
        name: string;
        domain: string;       // 도메인 (웹, 모바일, API 등)
        technology: string[]; // 사용 기술
    };
    generationOptions: {
        includePositiveTests: boolean;
        includeNegativeTests: boolean;
        includeBoundaryTests: boolean;
        includePerformanceTests: boolean;
        includeSecurityTests: boolean;
        maxTestCases: number;
        priorityFilter?: 'high' | 'medium' | 'low';
    };
}
