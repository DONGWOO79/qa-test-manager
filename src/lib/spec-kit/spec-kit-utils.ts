/**
 * Spec Kit 유틸리티 함수들
 * PDF 분석, 명세서 생성, 검증 등의 핵심 로직
 */

import {
    SpecKitSpecification,
    ExtractedContent,
    SpecKitGenerationResult,
    TestCaseGenerationContext,
    UserStory,
    Scenario,
    AcceptanceCriteria
} from '@/types/spec-kit';

/**
 * PDF 내용을 Spec Kit 구조로 변환하기 위한 분석 함수
 */
export class SpecKitAnalyzer {

    /**
     * PDF 텍스트에서 핵심 섹션들을 식별하고 추출
     */
    static extractSections(text: string): Record<string, string> {
        const sections: Record<string, string> = {};

        // 섹션 패턴들 (한국어/영어 대응)
        const sectionPatterns = {
            overview: /(?:개요|목적|목표|overview|purpose|goal)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis,
            functionality: /(?:기능|요구사항|functional|requirement|feature)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis,
            technical: /(?:기술|시스템|아키텍처|technical|system|architecture)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis,
            scenarios: /(?:시나리오|사용자|workflow|scenario|user)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis,
            constraints: /(?:제약|한계|제한|constraint|limitation|restriction)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis,
            acceptance: /(?:수용|승인|기준|acceptance|criteria|condition)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis,
            security: /(?:보안|인증|권한|security|authentication|authorization)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis,
            performance: /(?:성능|속도|처리량|performance|speed|throughput)(.*?)(?=\n\s*(?:\d+\.|\w+:|$))/gis
        };

        for (const [key, pattern] of Object.entries(sectionPatterns)) {
            const matches = text.match(pattern);
            if (matches && matches.length > 0) {
                sections[key] = matches.join('\n').trim();
            }
        }

        return sections;
    }

    /**
     * 사용자 스토리 추출 (한국어 문서 특화)
     */
    static extractUserStories(text: string): UserStory[] {
        const stories: UserStory[] = [];

        // 한국어 문서에서 사용자 요구사항을 추출하는 다양한 패턴
        const userStoryPatterns = [
            // 직접적인 사용자 스토리 패턴
            /(?:사용자로서|관리자로서|고객으로서)\s+(.+?)(?:원한다|하고싶다|필요하다)/gi,
            /As\s+a\s+(.+?)\s+I\s+want\s+(.+?)\s+so\s+that\s+(.+?)(?:\.|$)/gi,

            // 기능 요구사항 패턴
            /(?:기능|요구사항|요구)\s*:?\s*(.+?)(?:\n|$)/gi,
            /(?:사용자는|관리자는|시스템은)\s+(.+?)(?:할\s*수\s*있다|해야\s*한다|가능하다)/gi,

            // 목적/목표 패턴  
            /(?:목적|목표|의도)\s*:?\s*(.+?)(?:\n|$)/gi,
            /(?:위해|하기\s*위해)\s+(.+?)(?:한다|해야\s*한다)/gi,

            // 변경사항 패턴
            /(?:변경|수정|개선|추가)\s*:?\s*(.+?)(?:\n|$)/gi,
            /(.+?)(?:변경|수정|개선|추가)(?:한다|해야\s*한다|됨)/gi
        ];

        userStoryPatterns.forEach((pattern, patternIndex) => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                let userRole = '사용자';
                let userWant = '';
                let userSo = '';

                if (patternIndex === 0) {
                    // 직접적인 사용자 스토리
                    userRole = '사용자';
                    userWant = match[1]?.trim() || '';
                } else if (patternIndex === 1) {
                    // As a 패턴
                    userRole = match[1]?.trim() || '사용자';
                    userWant = match[2]?.trim() || '';
                    userSo = match[3]?.trim() || '';
                } else {
                    // 기타 패턴들
                    userRole = '사용자';
                    userWant = match[1]?.trim() || '';
                    userSo = '시스템 기능 개선';
                }

                if (userWant && userWant.length > 5) { // 최소 길이 체크
                    const story: UserStory = {
                        id: `us-${stories.length + 1}`,
                        as: userRole,
                        want: userWant,
                        so: userSo || '시스템 사용성 향상',
                        priority: 'medium',
                        acceptanceCriteria: []
                    };

                    stories.push(story);
                }
            }
        });

        // 중복 제거
        const uniqueStories = stories.filter((story, index, self) =>
            index === self.findIndex(s => s.want.toLowerCase() === story.want.toLowerCase())
        );

        return uniqueStories.slice(0, 10); // 최대 10개로 제한
    }

    /**
     * 시나리오 추출 (한국어 문서 특화)
     */
    static extractScenarios(text: string): Scenario[] {
        const scenarios: Scenario[] = [];

        // 다양한 시나리오 패턴들
        const scenarioPatterns = [
            // 직접적인 시나리오 패턴
            /(?:시나리오|테스트케이스|케이스)\s*(\d+)?\s*:?\s*(.+?)(?=(?:시나리오|테스트케이스|케이스|\n\s*$))/gis,

            // 기능 설명 패턴
            /(?:기능|동작|처리|실행)\s*:?\s*(.+?)(?:\n|$)/gi,

            // 단계별 프로세스 패턴
            /(\d+)\.\s*(.+?)(?=\n\d+\.|\n\s*$|$)/gs,

            // 변경 사항 패턴
            /(?:변경|수정|개선|추가)\s*사항\s*:?\s*(.+?)(?:\n|$)/gi,

            // 워크플로우 패턴
            /(?:절차|과정|단계|방법)\s*:?\s*(.+?)(?:\n|$)/gi
        ];

        scenarioPatterns.forEach((pattern, patternIndex) => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                let title = '';
                let description = '';

                if (patternIndex === 0) {
                    // 직접적인 시나리오
                    title = match[2]?.trim()?.split('\n')[0] || `시나리오 ${scenarios.length + 1}`;
                    description = match[2]?.trim() || '';
                } else if (patternIndex === 2) {
                    // 번호가 있는 단계
                    title = `단계 ${match[1]}: ${match[2]?.trim()?.substring(0, 50) || ''}`;
                    description = match[2]?.trim() || '';
                } else {
                    // 기타 패턴들
                    title = match[1]?.trim()?.substring(0, 50) || `기능 ${scenarios.length + 1}`;
                    description = match[1]?.trim() || '';
                }

                if (description && description.length > 10) { // 최소 길이 체크
                    const scenario: Scenario = {
                        id: `scenario-${scenarios.length + 1}`,
                        title: title,
                        description: description,
                        preconditions: this.extractPreconditions(description),
                        steps: this.extractSteps(description),
                        expectedResults: this.extractExpectedResults(description),
                        postconditions: [],
                        priority: 'medium',
                        complexity: 'moderate'
                    };

                    scenarios.push(scenario);
                }
            }
        });

        // 중복 제거 및 정리
        const uniqueScenarios = scenarios.filter((scenario, index, self) =>
            index === self.findIndex(s =>
                s.title.toLowerCase() === scenario.title.toLowerCase() ||
                s.description.substring(0, 100).toLowerCase() === scenario.description.substring(0, 100).toLowerCase()
            )
        );

        return uniqueScenarios.slice(0, 15); // 최대 15개로 제한
    }

    /**
     * 사전 조건 추출
     */
    private static extractPreconditions(text: string): string[] {
        const patterns = [
            /(?:사전\s*조건|전제\s*조건|precondition)[:\s]*(.+?)(?=\n|$)/gi,
            /(?:준비|설정|setup)[:\s]*(.+?)(?=\n|$)/gi
        ];

        const conditions: string[] = [];
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const condition = match[1]?.trim();
                if (condition) {
                    conditions.push(condition);
                }
            }
        });

        return conditions;
    }

    /**
     * 테스트 단계 추출
     */
    private static extractSteps(text: string): any[] {
        const steps: any[] = [];

        // 숫자로 시작하는 단계들 찾기
        const stepPattern = /(\d+)\.\s*(.+?)(?=\n\d+\.|\n\s*$|$)/gs;

        let match;
        let stepNumber = 1;
        while ((match = stepPattern.exec(text)) !== null) {
            const action = match[2]?.trim();
            if (action) {
                steps.push({
                    stepNumber: stepNumber++,
                    action: action,
                    expectedResult: ''
                });
            }
        }

        return steps;
    }

    /**
     * 예상 결과 추출
     */
    private static extractExpectedResults(text: string): string[] {
        const patterns = [
            /(?:예상\s*결과|기대\s*결과|expected\s*result)[:\s]*(.+?)(?=\n|$)/gi,
            /(?:결과|result)[:\s]*(.+?)(?=\n|$)/gi
        ];

        const results: string[] = [];
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const result = match[1]?.trim();
                if (result) {
                    results.push(result);
                }
            }
        });

        return results;
    }
}

/**
 * Spec Kit 생성기
 */
export class SpecKitGenerator {

    /**
     * PDF 내용으로부터 Spec Kit 명세서 생성
     */
    static async generateSpecification(
        extractedContent: ExtractedContent,
        projectName: string
    ): Promise<SpecKitGenerationResult> {

        const sections = SpecKitAnalyzer.extractSections(extractedContent.text);
        const userStories = SpecKitAnalyzer.extractUserStories(extractedContent.text);
        const scenarios = SpecKitAnalyzer.extractScenarios(extractedContent.text);

        const specification: SpecKitSpecification = {
            id: `spec-${Date.now()}`,
            title: projectName,
            version: '1.0.0',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),

            functionality: {
                overview: sections.overview || sections.functionality || '기능 개요가 명시되지 않음',
                purpose: `${projectName}의 핵심 기능 구현`,
                scope: this.extractScope(extractedContent.text),
                userStories: userStories,
                businessRules: this.extractBusinessRules(extractedContent.text)
            },

            technical: {
                architecture: this.extractArchitecture(extractedContent.text),
                technologies: this.extractTechnologies(extractedContent.text),
                integrations: this.extractIntegrations(extractedContent.text),
                performance: this.extractPerformanceRequirements(extractedContent.text),
                security: this.extractSecurityRequirements(extractedContent.text)
            },

            scenarios: {
                primary: scenarios.filter(s => s.priority === 'high'),
                alternative: scenarios.filter(s => s.priority === 'medium'),
                exception: this.extractExceptionScenarios(extractedContent.text),
                edge: this.extractEdgeScenarios(extractedContent.text)
            },

            constraints: {
                functional: this.extractFunctionalConstraints(extractedContent.text),
                technical: this.extractTechnicalConstraints(extractedContent.text),
                business: this.extractBusinessConstraints(extractedContent.text),
                regulatory: this.extractRegulatoryConstraints(extractedContent.text)
            },

            acceptance: {
                functional: this.extractFunctionalAcceptance(extractedContent.text),
                performance: this.extractPerformanceAcceptance(extractedContent.text),
                usability: this.extractUsabilityAcceptance(extractedContent.text),
                security: this.extractSecurityAcceptance(extractedContent.text)
            },

            testStrategy: {
                approach: this.generateTestApproaches(projectName),
                coverage: this.generateTestCoverage(),
                priorities: this.generateTestPriorities(userStories, scenarios),
                risks: this.generateTestRisks(extractedContent.text)
            }
        };

        return {
            specification,
            confidence: this.calculateConfidence(specification),
            warnings: this.generateWarnings(specification),
            suggestions: this.generateSuggestions(specification)
        };
    }

    // 각종 추출 메소드들 (간소화된 버전)
    private static extractScope(text: string): string[] {
        // 범위 관련 키워드 추출
        return ['기본 기능', '사용자 인터페이스', '데이터 관리'];
    }

    private static extractBusinessRules(text: string): string[] {
        // 비즈니스 규칙 추출
        return [];
    }

    private static extractArchitecture(text: string): string[] {
        // 아키텍처 요구사항 추출
        return ['웹 기반 시스템', 'RESTful API'];
    }

    private static extractTechnologies(text: string): string[] {
        // 기술 스택 추출
        const techKeywords = ['React', 'Node.js', 'TypeScript', 'Next.js', 'SQLite'];
        return techKeywords.filter(tech =>
            text.toLowerCase().includes(tech.toLowerCase())
        );
    }

    private static extractIntegrations(text: string): string[] {
        // 외부 연동 추출
        return [];
    }

    private static extractPerformanceRequirements(text: string): any[] {
        // 성능 요구사항 추출
        return [];
    }

    private static extractSecurityRequirements(text: string): any[] {
        // 보안 요구사항 추출
        return [];
    }

    private static extractExceptionScenarios(text: string): Scenario[] {
        // 예외 시나리오 추출
        return [];
    }

    private static extractEdgeScenarios(text: string): Scenario[] {
        // 경계값 시나리오 추출
        return [];
    }

    private static extractFunctionalConstraints(text: string): string[] {
        return [];
    }

    private static extractTechnicalConstraints(text: string): string[] {
        return [];
    }

    private static extractBusinessConstraints(text: string): string[] {
        return [];
    }

    private static extractRegulatoryConstraints(text: string): string[] {
        return [];
    }

    private static extractFunctionalAcceptance(text: string): AcceptanceCriteria[] {
        return [];
    }

    private static extractPerformanceAcceptance(text: string): AcceptanceCriteria[] {
        return [];
    }

    private static extractUsabilityAcceptance(text: string): AcceptanceCriteria[] {
        return [];
    }

    private static extractSecurityAcceptance(text: string): AcceptanceCriteria[] {
        return [];
    }

    private static generateTestApproaches(projectName: string): any[] {
        return [
            {
                type: 'functional',
                description: '기능 테스트',
                tools: ['Manual Testing', 'Automated Testing'],
                coverage: 90
            }
        ];
    }

    private static generateTestCoverage(): any[] {
        return [
            {
                area: '기능 테스트',
                target: 90,
                priority: 'high'
            }
        ];
    }

    private static generateTestPriorities(userStories: UserStory[], scenarios: Scenario[]): any[] {
        return [];
    }

    private static generateTestRisks(text: string): any[] {
        return [];
    }

    private static calculateConfidence(spec: SpecKitSpecification): number {
        // 명세서 완성도 기반 신뢰도 계산
        let score = 0;
        let maxScore = 0;

        // 기능 명세 평가
        maxScore += 20;
        if (spec.functionality.overview !== '기능 개요가 명시되지 않음') score += 20;

        // 사용자 스토리 평가
        maxScore += 20;
        if (spec.functionality.userStories.length > 0) score += 20;

        // 시나리오 평가
        maxScore += 20;
        const totalScenarios = spec.scenarios.primary.length + spec.scenarios.alternative.length;
        if (totalScenarios > 0) score += 20;

        // 기술 요구사항 평가
        maxScore += 20;
        if (spec.technical.technologies.length > 0) score += 20;

        // 테스트 전략 평가
        maxScore += 20;
        if (spec.testStrategy.approach.length > 0) score += 20;

        return Math.round((score / maxScore) * 100) / 100;
    }

    private static generateWarnings(spec: SpecKitSpecification): string[] {
        const warnings: string[] = [];

        if (spec.functionality.userStories.length === 0) {
            warnings.push('사용자 스토리가 감지되지 않았습니다.');
        }

        if (spec.scenarios.primary.length === 0) {
            warnings.push('주요 시나리오가 감지되지 않았습니다.');
        }

        if (spec.technical.technologies.length === 0) {
            warnings.push('기술 스택 정보가 감지되지 않았습니다.');
        }

        return warnings;
    }

    private static generateSuggestions(spec: SpecKitSpecification): string[] {
        const suggestions: string[] = [];

        if (spec.functionality.userStories.length < 3) {
            suggestions.push('더 구체적인 사용자 스토리를 추가하는 것을 권장합니다.');
        }

        if (spec.scenarios.exception.length === 0) {
            suggestions.push('예외 상황에 대한 시나리오를 추가하는 것을 권장합니다.');
        }

        return suggestions;
    }
}

/**
 * Spec Kit 검증기
 */
export class SpecKitValidator {

    /**
     * 명세서 유효성 검증
     */
    static validate(spec: SpecKitSpecification): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 필수 필드 검증
        if (!spec.title || spec.title.trim() === '') {
            errors.push('제목이 필요합니다.');
        }

        if (!spec.functionality.overview || spec.functionality.overview.trim() === '') {
            errors.push('기능 개요가 필요합니다.');
        }

        // 경고 조건 검증
        if (spec.functionality.userStories.length === 0) {
            warnings.push('사용자 스토리가 없습니다.');
        }

        const totalScenarios = spec.scenarios.primary.length +
            spec.scenarios.alternative.length +
            spec.scenarios.exception.length;

        if (totalScenarios === 0) {
            warnings.push('테스트 시나리오가 없습니다.');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}
