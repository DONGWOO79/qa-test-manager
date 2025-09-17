const fs = require('fs');
const path = require('path');

// 간단한 테스트용 PDF.js 이미지 추출 테스트
async function testSimplePDF() {
    try {
        // PDF.js 이미지 추출 함수 import
        const { extractImagesFromPDF } = require('./src/lib/pdf-image-extractor-v2.js');

        console.log('🧪 PDF.js 테스트 시작...');

        // 테스트할 PDF 파일 - node_modules의 테스트 파일 사용
        const testPDF = './node_modules/pdf-parse/test/data/01-valid.pdf';

        console.log(`📄 테스트 대상: ${testPDF}`);

        // 파일 존재 확인
        if (!fs.existsSync(testPDF)) {
            console.log('❌ 테스트 PDF 파일을 찾을 수 없습니다.');
            return;
        }

        // 파일 크기 확인
        const pdfStats = fs.statSync(testPDF);
        console.log(`📁 PDF 파일 크기: ${Math.round(pdfStats.size / 1024)}KB`);

        // 이전 이미지 파일들 정리
        const outputDir = './temp/pdf-test-images';
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true });
        }

        // PDF.js로 이미지 추출 시도
        console.log('🔄 PDF.js 이미지 추출 시작...');
        const images = await extractImagesFromPDF(testPDF, outputDir);

        console.log(`✅ 추출 완료: ${images.length}개 이미지`);

        // 각 이미지 파일 크기 확인
        for (const imagePath of images) {
            const stats = fs.statSync(imagePath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`📸 ${path.basename(imagePath)}: ${sizeKB}KB`);

            if (sizeKB < 5) {
                console.log(`⚠️  ${path.basename(imagePath)}: 파일이 너무 작음 (빈 이미지 가능성)`);
            } else if (sizeKB > 10) {
                console.log(`✅ ${path.basename(imagePath)}: 정상적인 크기 (내용 있음)`);
            }
        }

        // 첫 번째 이미지 상세 정보
        if (images.length > 0) {
            const firstImage = images[0];
            console.log(`\n🔍 첫 번째 이미지 분석: ${firstImage}`);

            // 파일 헤더 확인 (JPEG 시그니처)
            const buffer = fs.readFileSync(firstImage);
            const header = buffer.slice(0, 4).toString('hex');
            console.log(`📋 파일 헤더: ${header} ${header === 'ffd8ffe0' || header.startsWith('ffd8') ? '(유효한 JPEG)' : '(비정상 파일)'}`);
        }

    } catch (error) {
        console.error('❌ PDF.js 테스트 실패:', error.message);
        console.error('상세 오류:', error);
    }
}

// 테스트 실행
testSimplePDF();