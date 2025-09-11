const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// 최신 pdfjs-dist는 ES modules를 사용하므로 dynamic import 필요
let pdfjsLib = null;

async function initPDFJS() {
    if (!pdfjsLib) {
        // Node.js 환경에서는 legacy 빌드 사용
        pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        // 워커 설정
        pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    }
    return pdfjsLib;
}

/**
 * PDF.js를 사용하여 PDF에서 이미지를 추출하는 함수
 * @param {string} pdfPath - PDF 파일 경로
 * @param {string} outputDir - 이미지 저장할 디렉토리
 * @returns {Promise<string[]>} 추출된 이미지 파일 경로들
 */
async function extractImagesFromPDF(pdfPath, outputDir = './temp/pdf-images-v2') {
    try {
        console.log('PDF.js 이미지 추출 시작:', pdfPath);

        // PDF.js 초기화
        const pdfjs = await initPDFJS();

        // 출력 디렉토리 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // PDF 파일 읽기
        const pdfBuffer = fs.readFileSync(pdfPath);

        // Buffer를 Uint8Array로 변환 (PDF.js 요구사항)
        const pdfData = new Uint8Array(pdfBuffer);

        // PDF 문서 로드
        const loadingTask = pdfjs.getDocument({
            data: pdfData,
            useSystemFonts: true
        });

        const pdfDocument = await loadingTask.promise;
        console.log(`PDF 로드 완료: ${pdfDocument.numPages}페이지`);

        const imageFiles = [];

        // 각 페이지를 이미지로 변환
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            try {
                console.log(`페이지 ${pageNum} 처리 중...`);

                // 페이지 로드
                const page = await pdfDocument.getPage(pageNum);

                // 페이지 크기 정보 (Google Vision API용 최적화된 해상도)
                const viewport = page.getViewport({ scale: 2.5 }); // 2.5배 해상도로 최적화

                // Canvas 생성
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                // 페이지를 Canvas에 렌더링
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // 이미지 파일로 저장 (JPEG로 압축하여 용량 최적화)
                const fileName = `page-${pageNum.toString().padStart(2, '0')}.jpg`;
                const filePath = path.join(outputDir, fileName);

                const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 }); // 90% 품질
                fs.writeFileSync(filePath, buffer);

                imageFiles.push(filePath);
                console.log(`페이지 ${pageNum} 저장 완료: ${filePath} (${Math.round(buffer.length / 1024)}KB)`);

            } catch (pageError) {
                console.warn(`페이지 ${pageNum} 처리 실패:`, pageError.message);
            }
        }

        console.log(`총 ${imageFiles.length}개 이미지 추출 완료`);
        return imageFiles;

    } catch (error) {
        console.error('PDF.js 이미지 추출 오류:', error);
        throw new Error(`PDF 이미지 추출 실패: ${error.message}`);
    }
}

/**
 * 이미지가 다이어그램/차트인지 간단히 판단하는 함수
 * (향후 개선 가능)
 * @param {string} imagePath - 이미지 파일 경로
 * @returns {boolean} 다이어그램 여부
 */
function isLikelyChart(imagePath) {
    try {
        const stats = fs.statSync(imagePath);
        const fileSizeKB = stats.size / 1024;

        // 간단한 휴리스틱:
        // - 파일 크기가 너무 작으면 (50KB 미만) 텍스트만 있을 가능성
        // - 파일 크기가 적당하면 (50KB~500KB) 다이어그램일 가능성
        // - 너무 크면 (500KB 이상) 복잡한 이미지/사진일 가능성

        if (fileSizeKB < 50) {
            console.log(`${path.basename(imagePath)}: 텍스트 페이지 (${Math.round(fileSizeKB)}KB)`);
            return false;
        } else if (fileSizeKB > 500) {
            console.log(`${path.basename(imagePath)}: 복잡한 이미지 (${Math.round(fileSizeKB)}KB)`);
            return false;
        } else {
            console.log(`${path.basename(imagePath)}: 다이어그램 가능성 (${Math.round(fileSizeKB)}KB)`);
            return true;
        }
    } catch (error) {
        console.warn('파일 분석 실패:', error.message);
        return false;
    }
}

/**
 * 임시 이미지 파일들 정리
 * @param {string} outputDir - 정리할 디렉토리
 */
function cleanupTempImages(outputDir = './temp/pdf-images-v2') {
    try {
        if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(outputDir, file));
            });
            fs.rmdirSync(outputDir);
            console.log('임시 이미지 파일 정리 완료');
        }
    } catch (error) {
        console.warn('임시 파일 정리 중 오류:', error.message);
    }
}

module.exports = {
    extractImagesFromPDF,
    isLikelyChart,
    cleanupTempImages
};
