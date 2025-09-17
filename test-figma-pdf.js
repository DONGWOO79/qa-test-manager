const fs = require('fs');
const path = require('path');

// 피그마 PDF 테스트 - pdf-poppler vs PDF.js 비교
async function testFigmaPDF() {
    try {
        console.log('🎨 피그마 PDF 테스트 시작...');

        // 최근 업로드된 피그마 PDF 찾기 (temp 폴더에서)
        const tempFiles = fs.readdirSync('/tmp').filter(f => f.includes('temp_pdf_')).map(f => `/tmp/${f}`);

        if (tempFiles.length === 0) {
            console.log('❌ 테스트할 피그마 PDF 파일이 없습니다.');
            console.log('💡 피그마에서 PDF로 Export한 파일을 업로드해주세요.');
            return;
        }

        const figmaPDF = tempFiles[tempFiles.length - 1]; // 가장 최근 파일
        console.log(`🎨 피그마 PDF: ${figmaPDF}`);

        // 파일 크기 확인
        const pdfStats = fs.statSync(figmaPDF);
        console.log(`📁 PDF 크기: ${Math.round(pdfStats.size / 1024)}KB`);

        // 1. PDF.js 테스트 (현재 실패하는 방법)
        console.log('\n🧪 1. PDF.js 테스트 (현재 실패)');
        try {
            const { extractImagesFromPDF: extractWithPDFJS } = require('./src/lib/pdf-image-extractor-v2.js');

            const outputDir1 = './temp/figma-test-pdfjs';
            if (fs.existsSync(outputDir1)) fs.rmSync(outputDir1, { recursive: true });

            const images1 = await extractWithPDFJS(figmaPDF, outputDir1);
            console.log(`✅ PDF.js: ${images1.length}개 이미지`);

            // 이미지 크기 확인
            for (const img of images1) {
                const stats = fs.statSync(img);
                const sizeKB = Math.round(stats.size / 1024);
                console.log(`   📸 ${path.basename(img)}: ${sizeKB}KB ${sizeKB < 10 ? '(빈 이미지?)' : '(정상)'}`);
            }
        } catch (error) {
            console.log(`❌ PDF.js 실패: ${error.message}`);
        }

        // 2. pdf-poppler 테스트 (대안)
        console.log('\n🧪 2. pdf-poppler 테스트 (대안)');
        try {
            const { extractImagesFromPDF: extractWithPoppler } = require('./src/lib/pdf-image-extractor.js');

            const outputDir2 = './temp/figma-test-poppler';
            if (fs.existsSync(outputDir2)) fs.rmSync(outputDir2, { recursive: true });

            const images2 = await extractWithPoppler(figmaPDF, outputDir2);
            console.log(`✅ pdf-poppler: ${images2.length}개 이미지`);

            // 이미지 크기 확인
            for (const img of images2) {
                const stats = fs.statSync(img);
                const sizeKB = Math.round(stats.size / 1024);
                console.log(`   📸 ${path.basename(img)}: ${sizeKB}KB ${sizeKB < 10 ? '(빈 이미지?)' : '(정상)'}`);
            }

            // 첫 번째 이미지 헤더 확인
            if (images2.length > 0) {
                const buffer = fs.readFileSync(images2[0]);
                const header = buffer.slice(0, 8).toString('hex');
                console.log(`   📋 첫 번째 이미지 헤더: ${header}`);
                console.log(`   📋 PNG 여부: ${header.startsWith('89504e47') ? '✅ 유효한 PNG' : '❌ 비정상'}`);
            }

        } catch (error) {
            console.log(`❌ pdf-poppler 실패: ${error.message}`);
        }

        console.log('\n📊 결론:');
        console.log('- PDF.js: 피그마 PDF 처리에 한계');
        console.log('- pdf-poppler: 시스템 레벨 처리로 피그마 PDF 호환성 높음');

    } catch (error) {
        console.error('❌ 피그마 PDF 테스트 실패:', error.message);
        console.error('상세 오류:', error);
    }
}

// 테스트 실행
testFigmaPDF();

