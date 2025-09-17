/**
 * Spec Kit 설정 및 상수
 */

export const SPEC_KIT_CONFIG = {
    // 버전 정보
    VERSION: '1.0.0',

    // 지원하는 언어
    SUPPORTED_LANGUAGES: ['ko', 'en'],
    DEFAULT_LANGUAGE: 'ko',

    // 분석 설정
    ANALYSIS: {
        MIN_TEXT_LENGTH: 100,           // 최소 텍스트 길이
        MAX_TEXT_LENGTH: 50000,         // 최대 텍스트 길이
        MIN_CONFIDENCE_THRESHOLD: 0.3,  // 최소 신뢰도 임계값
        MAX_USER_STORIES: 20,           // 최대 사용자 스토리 수
        MAX_SCENARIOS: 50,              // 최대 시나리오 수
    },

    // 테스트케이스 생성 설정
    TEST_GENERATION: {
        DEFAULT_MAX_CASES: 15,          // 기본 최대 테스트케이스 수
        MIN_CASES_PER_SCENARIO: 1,      // 시나리오당 최소 케이스 수
        MAX_CASES_PER_SCENARIO: 5,      // 시나리오당 최대 케이스 수
        PRIORITY_WEIGHTS: {
            high: 3,
            medium: 2,
            low: 1
        }
    },

    // 키워드 패턴 (한국어)
    PATTERNS: {
        KO: {
            SECTIONS: {
                overview: ['개요', '목적', '목표', '소개'],
                functionality: ['기능', '요구사항', '요구 사항', '기능 요구사항'],
                technical: ['기술', '시스템', '아키텍처', '기술적 요구사항'],
                scenarios: ['시나리오', '사용자 시나리오', '테스트 시나리오'],
                constraints: ['제약', '제한', '제약사항', '제한사항'],
                acceptance: ['수용', '승인', '수용 기준', '승인 기준'],
                security: ['보안', '인증', '권한', '보안 요구사항'],
                performance: ['성능', '속도', '처리량', '성능 요구사항']
            },

            USER_STORY: {
                patterns: [
                    /(?:사용자로서|관리자로서|고객으로서)\s+(.+?)(?:원한다|하고\s*싶다|필요하다)/gi,
                    /(.+?)(?:사용자|관리자|고객)(?:는|이)\s+(.+?)(?:원한다|하고\s*싶다|필요하다)/gi
                ]
            },

            PRECONDITIONS: ['사전 조건', '전제 조건', '사전조건', '전제조건', '준비사항'],
            STEPS: ['단계', '절차', '과정', '방법'],
            EXPECTED_RESULTS: ['예상 결과', '기대 결과', '예상결과', '기대결과', '결과'],

            PRIORITIES: {
                high: ['높음', '상', '중요', '필수', '핵심'],
                medium: ['보통', '중', '일반', '기본'],
                low: ['낮음', '하', '부가', '선택']
            }
        },

        EN: {
            SECTIONS: {
                overview: ['overview', 'purpose', 'goal', 'introduction'],
                functionality: ['functionality', 'functional', 'requirements', 'features'],
                technical: ['technical', 'system', 'architecture', 'technical requirements'],
                scenarios: ['scenarios', 'user scenarios', 'test scenarios'],
                constraints: ['constraints', 'limitations', 'restrictions'],
                acceptance: ['acceptance', 'acceptance criteria', 'acceptance conditions'],
                security: ['security', 'authentication', 'authorization', 'security requirements'],
                performance: ['performance', 'speed', 'throughput', 'performance requirements']
            },

            USER_STORY: {
                patterns: [
                    /As\s+a\s+(.+?)\s+I\s+want\s+(.+?)\s+so\s+that\s+(.+?)(?:\.|$)/gi
                ]
            },

            PRECONDITIONS: ['preconditions', 'prerequisites', 'setup', 'given'],
            STEPS: ['steps', 'procedure', 'process', 'when'],
            EXPECTED_RESULTS: ['expected results', 'expected', 'results', 'then'],

            PRIORITIES: {
                high: ['high', 'critical', 'must', 'essential'],
                medium: ['medium', 'normal', 'should'],
                low: ['low', 'nice to have', 'could']
            }
        }
    },

    // 기본 테스트 전략
    DEFAULT_TEST_STRATEGIES: [
        {
            type: 'unit' as const,
            description: '단위 테스트 - 개별 컴포넌트 기능 검증',
            tools: ['Jest', 'Mocha', 'JUnit'],
            coverage: 90
        },
        {
            type: 'integration' as const,
            description: '통합 테스트 - 컴포넌트 간 연동 검증',
            tools: ['Postman', 'Jest', 'Supertest'],
            coverage: 80
        },
        {
            type: 'system' as const,
            description: '시스템 테스트 - 전체 시스템 동작 검증',
            tools: ['Manual Testing', 'Load Testing Tools'],
            coverage: 70
        },
        {
            type: 'acceptance' as const,
            description: '사용자 승인 테스트 - 사용자 관점 검증',
            tools: ['Manual Testing', 'User Testing'],
            coverage: 95
        }
    ],

    // 기본 테스트 커버리지 목표
    DEFAULT_TEST_COVERAGE: [
        {
            area: '핵심 기능',
            target: 95,
            priority: 'high' as const
        },
        {
            area: '사용자 인터페이스',
            target: 85,
            priority: 'high' as const
        },
        {
            area: '데이터 처리',
            target: 90,
            priority: 'medium' as const
        },
        {
            area: '오류 처리',
            target: 80,
            priority: 'medium' as const
        },
        {
            area: '성능',
            target: 70,
            priority: 'low' as const
        }
    ],

    // 일반적인 테스트 리스크
    COMMON_TEST_RISKS: [
        {
            risk: '불충분한 요구사항 정의',
            impact: 'high' as const,
            probability: 'medium' as const,
            mitigation: '요구사항 검토 및 명확화 과정 강화'
        },
        {
            risk: '테스트 데이터 부족',
            impact: 'medium' as const,
            probability: 'high' as const,
            mitigation: '테스트 데이터 생성 및 관리 계획 수립'
        },
        {
            risk: '환경 설정 복잡성',
            impact: 'medium' as const,
            probability: 'medium' as const,
            mitigation: '테스트 환경 자동화 및 문서화'
        },
        {
            risk: '시간 제약',
            impact: 'high' as const,
            probability: 'high' as const,
            mitigation: '우선순위 기반 테스트 실행 및 자동화 확대'
        }
    ]
};

// 도메인별 특화 설정
export const DOMAIN_SPECIFIC_CONFIG = {
    WEB: {
        testTypes: ['functional', 'ui', 'cross-browser', 'responsive', 'accessibility'],
        tools: ['Selenium', 'Cypress', 'Playwright', 'Jest', 'Testing Library'],
        priorities: ['사용자 경험', '브라우저 호환성', '반응형 디자인']
    },

    MOBILE: {
        testTypes: ['functional', 'ui', 'device-compatibility', 'performance', 'usability'],
        tools: ['Appium', 'Detox', 'XCTest', 'Espresso'],
        priorities: ['디바이스 호환성', '성능', '사용성']
    },

    API: {
        testTypes: ['functional', 'integration', 'performance', 'security', 'contract'],
        tools: ['Postman', 'Rest Assured', 'Supertest', 'JMeter'],
        priorities: ['기능 정확성', '성능', '보안', '계약 준수']
    },

    DATABASE: {
        testTypes: ['data-integrity', 'performance', 'security', 'backup-recovery'],
        tools: ['SQL Testing Tools', 'DBUnit', 'Liquibase'],
        priorities: ['데이터 무결성', '성능', '백업 복구']
    }
};

// 품질 지표
export const QUALITY_METRICS = {
    SPECIFICATION_COMPLETENESS: {
        EXCELLENT: 0.9,
        GOOD: 0.7,
        FAIR: 0.5,
        POOR: 0.3
    },

    TEST_COVERAGE_TARGETS: {
        CRITICAL: 95,
        HIGH: 85,
        MEDIUM: 75,
        LOW: 60
    }
};
