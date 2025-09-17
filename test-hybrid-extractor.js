const fs = require('fs');

// 하이브리드 PDF 추출기 테스트
async function testHybridExtractor() {
    try {
        console.log('🧪 하이브리드 PDF 추출기 테스트 시작...');

        const { extractImagesFromPDF, HybridPDFExtractor } = require('./src/lib/pdf-image-extractor-hybrid.js');

        // 테스트 파일들
        const testFiles = [
            // 일반 PDF (성공 예상)
            './node_modules/pdf-parse/test/data/01-valid.pdf',
            // 피그마 PDF (업로드된 파일 있으면)
            ...fs.readdirSync('/tmp').filter(f => f.includes('temp_pdf_')).map(f => `/tmp/${f}`)
        ];

        console.log('테스트 대상 파일들:', testFiles);

        for (const testFile of testFiles) {
            if (!fs.existsSync(testFile)) {
                console.log(`❌ 파일 없음: ${testFile}`);
                continue;
            }

            console.log(`\n📄 테스트 중: ${testFile}`);

            // 하이브리드 추출기 인스턴스
            const extractor = new HybridPDFExtractor();

            // PDF 분석
            const analysis = await extractor.analyzePDF(testFile);
            console.log('📊 PDF 분석:', {
                크기: `${analysis.size}KB`,
                버전: analysis.version,
                폰트: analysis.hasFonts ? '✅' : '❌',
                이미지: analysis.hasImages ? '✅' : '❌',
                텍스트: analysis.hasText ? '✅' : '❌',
                피그마형: analysis.isFigmaLike ? '✅ (pdf-poppler 권장)' : '❌ (PDF.js 권장)',
                권장방법: analysis.recommendedMethod
            });

            // 이미지 추출 테스트
            const outputDir = `./temp/hybrid-test-${Date.now()}`;
            const result = await extractor.extractImages(testFile, outputDir);

            console.log('🎯 추출 결과:', {
                성공: result.success ? '✅' : '❌',
                방법: result.method,
                이미지수: result.images.length
            });

            // 추출된 이미지 검증
            if (result.images.length > 0) {
                console.log('📸 추출된 이미지들:');
                for (const img of result.images) {
                    const stats = fs.statSync(img);
                    const sizeKB = Math.round(stats.size / 1024);
                    console.log(`   - ${require('path').basename(img)}: ${sizeKB}KB`);
                }
            }
        }

        console.log('\n✅ 하이브리드 추출기 테스트 완료');

    } catch (error) {
        console.error('❌ 테스트 실패:', error.message);
        console.error('상세 오류:', error);
    }
}

// 테스트 실행
testHybridExtractor();

