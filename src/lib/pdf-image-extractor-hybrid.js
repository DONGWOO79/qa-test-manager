const fs = require('fs');
const path = require('path');

/**
 * 하이브리드 PDF 이미지 추출기
 * PDF.js 실패 시 자동으로 pdf-poppler로 대체
 * 피그마 PDF 등 특수 형식 지원
 */
class HybridPDFExtractor {
    constructor() {
        this.pdfjs = null;
    }

    /**
     * PDF에서 이미지 추출 (하이브리드 방식)
     * @param {string} pdfPath - PDF 파일 경로
     * @param {string} outputDir - 이미지 저장 디렉토리
     * @returns {Promise<{images: string[], method: string, success: boolean}>}
     */
    async extractImages(pdfPath, outputDir = './temp/pdf-images-hybrid') {
        console.log('🔄 하이브리드 PDF 이미지 추출 시작:', pdfPath);

        // 출력 디렉토리 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 1차 시도: PDF.js (빠르고 품질 좋음)
        const pdfJsResult = await this.tryPDFJS(pdfPath, outputDir);
        if (pdfJsResult.success) {
            console.log(`✅ PDF.js 성공: ${pdfJsResult.images.length}개 이미지`);
            return {
                images: pdfJsResult.images,
                method: 'PDF.js',
                success: true
            };
        }

        console.log('⚠️ PDF.js 실패, pdf-poppler로 대체 시도...');

        // 2차 시도: pdf-poppler (피그마 PDF 등 특수 형식 지원)
        const popplerResult = await this.tryPoppler(pdfPath, outputDir);
        if (popplerResult.success) {
            console.log(`✅ pdf-poppler 성공: ${popplerResult.images.length}개 이미지`);
            return {
                images: popplerResult.images,
                method: 'pdf-poppler',
                success: true
            };
        }

        console.log('❌ 모든 PDF 처리 방법 실패');
        return {
            images: [],
            method: 'none',
            success: false
        };
    }

    /**
     * PDF.js로 이미지 추출 시도
     */
    async tryPDFJS(pdfPath, outputDir) {
        try {
            const { extractImagesFromPDF } = require('./pdf-image-extractor-v2.js');
            const images = await extractImagesFromPDF(pdfPath, outputDir);

            // 생성된 이미지들이 실제로 내용이 있는지 확인
            const validImages = [];
            const imageSizes = [];

            for (const imagePath of images) {
                const stats = fs.statSync(imagePath);
                const sizeKB = stats.size / 1024;
                imageSizes.push(stats.size);

                // 10KB 이상이면 유효한 이미지로 간주
                if (sizeKB >= 10) {
                    validImages.push(imagePath);
                }
            }

            // 🔍 모든 이미지가 동일한 크기인지 확인 (빈 이미지 감지)
            const uniqueSizes = [...new Set(imageSizes)];
            if (uniqueSizes.length === 1 && images.length > 1) {
                console.log(`⚠️ 모든 이미지가 동일한 크기(${uniqueSizes[0]} bytes)입니다. 빈 이미지로 판단하여 pdf-poppler로 대체합니다.`);
                return { images: [], success: false };
            }

            // 유효한 이미지가 50% 이상이면 성공으로 간주
            const successRate = validImages.length / Math.max(images.length, 1);
            if (successRate >= 0.5 && validImages.length > 0) {
                return { images: validImages, success: true };
            } else {
                console.log(`PDF.js 품질 부족: ${validImages.length}/${images.length} 유효 (${Math.round(successRate * 100)}%)`);
                return { images: [], success: false };
            }

        } catch (error) {
            console.log('PDF.js 오류:', error.message);
            return { images: [], success: false };
        }
    }

    /**
     * pdf-poppler로 이미지 추출 시도
     */
    async tryPoppler(pdfPath, outputDir) {
        try {
            const { extractImagesFromPDF } = require('./pdf-image-extractor.js');
            const images = await extractImagesFromPDF(pdfPath, outputDir);

            // 생성된 이미지들 검증
            const validImages = [];
            for (const imagePath of images) {
                if (fs.existsSync(imagePath)) {
                    const stats = fs.statSync(imagePath);
                    const sizeKB = stats.size / 1024;

                    // PNG/JPEG 헤더 확인
                    const buffer = fs.readFileSync(imagePath);
                    const header = buffer.slice(0, 8).toString('hex');
                    const isValidImage = header.startsWith('89504e47') || // PNG
                        header.startsWith('ffd8ff');      // JPEG

                    if (sizeKB >= 5 && isValidImage) {
                        validImages.push(imagePath);
                    }
                }
            }

            return {
                images: validImages,
                success: validImages.length > 0
            };

        } catch (error) {
            console.log('pdf-poppler 오류:', error.message);
            return { images: [], success: false };
        }
    }

    /**
     * PDF 파일 정보 분석
     */
    async analyzePDF(pdfPath) {
        try {
            const stats = fs.statSync(pdfPath);
            const buffer = fs.readFileSync(pdfPath, { encoding: null });

            // PDF 헤더 확인
            const header = buffer.slice(0, 8).toString();
            const isPDF = header.startsWith('%PDF-');

            // PDF 버전 추출
            const version = isPDF ? header.match(/%PDF-(\d\.\d)/)?.[1] : 'unknown';

            // 파일 내용 분석 (간단한 휴리스틱)
            const content = buffer.toString('latin1');
            const hasFonts = content.includes('/Font');
            const hasImages = content.includes('/Image') || content.includes('/XObject');
            const hasText = content.includes('/Text') || content.includes('BT') || content.includes('ET');

            // 피그마 PDF 특성 감지
            const isFigmaLike = content.includes('Figma') ||
                (!hasFonts && hasImages) || // 주로 이미지/벡터
                content.includes('/DeviceRGB') && !hasText; // 디자인 도구 특성

            return {
                size: Math.round(stats.size / 1024),
                version,
                isPDF,
                hasFonts,
                hasImages,
                hasText,
                isFigmaLike,
                recommendedMethod: isFigmaLike ? 'pdf-poppler' : 'PDF.js'
            };

        } catch (error) {
            console.log('PDF 분석 실패:', error.message);
            return {
                size: 0,
                version: 'unknown',
                isPDF: false,
                hasFonts: false,
                hasImages: false,
                hasText: false,
                isFigmaLike: false,
                recommendedMethod: 'PDF.js'
            };
        }
    }
}

// 싱글톤 인스턴스
const hybridExtractor = new HybridPDFExtractor();

/**
 * 하이브리드 PDF 이미지 추출 함수 (외부 API)
 * @param {string} pdfPath - PDF 파일 경로
 * @param {string} outputDir - 출력 디렉토리
 * @returns {Promise<string[]>} 추출된 이미지 파일 경로들
 */
async function extractImagesFromPDF(pdfPath, outputDir) {
    // PDF 분석
    const analysis = await hybridExtractor.analyzePDF(pdfPath);
    console.log('📊 PDF 분석 결과:', {
        크기: `${analysis.size}KB`,
        버전: analysis.version,
        피그마형식: analysis.isFigmaLike ? '✅' : '❌',
        권장방법: analysis.recommendedMethod
    });

    // 하이브리드 추출
    const result = await hybridExtractor.extractImages(pdfPath, outputDir);

    console.log(`🎯 최종 결과: ${result.method}로 ${result.images.length}개 이미지 추출`);

    return result.images;
}

module.exports = {
    extractImagesFromPDF,
    HybridPDFExtractor
};
