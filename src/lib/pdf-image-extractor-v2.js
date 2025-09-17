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

        // Node.js Canvas 호환성 설정
        const { Canvas, Image } = require('canvas');
        if (typeof globalThis.HTMLCanvasElement === 'undefined') {
            globalThis.HTMLCanvasElement = Canvas;
        }
        if (typeof globalThis.HTMLImageElement === 'undefined') {
            globalThis.HTMLImageElement = Image;
        }
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
        let failedPages = 0;

        // 각 페이지를 이미지로 변환
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            try {
                console.log(`페이지 ${pageNum} 처리 중...`);

                // 페이지 로드
                const page = await pdfDocument.getPage(pageNum);

                // 페이지 크기 정보 (피그마 PDF 최적화)
                const viewport = page.getViewport({ scale: 2.0 }); // 2배로 낮춰서 안정성 향상

                // Canvas 생성 (피그마 PDF 최적화)
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                // 피그마 PDF 벡터 렌더링 최적화
                context.imageSmoothingEnabled = false; // 벡터 PDF에서는 비활성화

                // 명시적 배경 설정 (투명도 문제 해결)
                context.fillStyle = '#FFFFFF';
                context.fillRect(0, 0, viewport.width, viewport.height);

                // PDF.js 렌더링 컨텍스트 - 피그마 PDF 특화
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    intent: 'print', // 벡터 PDF를 위한 print 모드
                    annotationMode: 0, // 주석 비활성화
                };

                await page.render(renderContext).promise;

                // 이미지 파일로 저장 (JPEG로 압축하여 용량 최적화)
                const fileName = `page-${pageNum.toString().padStart(2, '0')}.jpg`;
                const filePath = path.join(outputDir, fileName);

                const buffer = canvas.toBuffer('image/jpeg', { quality: 0.98 }); // 98% 품질로 최고품질 유지
                fs.writeFileSync(filePath, buffer);

                // 이미지 품질 검증
                const sizeKB = Math.round(buffer.length / 1024);

                // 빈 이미지 감지 (너무 작거나 동일한 크기)
                if (buffer.length < 50 * 1024) { // 50KB 미만이면 빈 이미지 의심
                    console.warn(`⚠️ 페이지 ${pageNum}: 이미지가 너무 작음 (${sizeKB}KB) - 빈 이미지 의심`);
                } else {
                    console.log(`✅ 페이지 ${pageNum} 저장 완료: ${filePath} (${sizeKB}KB)`);
                }

                imageFiles.push(filePath);

            } catch (pageError) {
                console.warn(`⚠️ 페이지 ${pageNum} 건너뜀 (PDF.js 호환성 문제):`, pageError.message);

                // 일반적인 PDF.js 호환성 오류는 간략하게 처리
                if (pageError.message.includes('Image or Canvas expected')) {
                    console.log(`   → PDF.js Node.js 환경 제한으로 인한 예상된 오류 (무시)`);
                } else {
                    console.error(`   → 예상치 못한 오류:`, pageError.message);
                }

                // 실패한 페이지 수 추적
                failedPages++;
            }
        }

        // 추출 결과 요약
        const successPages = imageFiles.length;
        const totalPages = pdfDocument.numPages;
        const successRate = ((successPages / totalPages) * 100).toFixed(1);

        console.log(`\n📊 PDF 이미지 추출 완료:`);
        console.log(`   ✅ 성공: ${successPages}/${totalPages}페이지 (${successRate}%)`);
        console.log(`   ❌ 실패: ${failedPages}페이지 (PDF.js 호환성 문제)`);

        if (successPages === 0) {
            console.log(`   ⚠️ 모든 페이지 추출 실패 - Vision AI 분석 불가`);
        } else if (successPages < totalPages / 2) {
            console.log(`   ⚠️ 절반 이하 페이지만 성공 - 제한적 분석 예상`);
        } else {
            console.log(`   ✅ 충분한 페이지 추출 성공 - 정상 분석 가능`);
        }

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
