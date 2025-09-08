const pdf = require('pdf-poppler');
const path = require('path');
const fs = require('fs');

/**
 * PDF에서 이미지를 추출하는 함수
 * @param {string} pdfPath - PDF 파일 경로
 * @param {string} outputDir - 이미지 저장할 디렉토리 (기본: temp 폴더)
 * @returns {Promise<string[]>} 추출된 이미지 파일 경로들
 */
async function extractImagesFromPDF(pdfPath, outputDir = './temp/pdf-images') {
    try {
        console.log('PDF 이미지 추출 시작:', pdfPath);

        // 출력 디렉토리 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // PDF를 이미지로 변환하는 옵션
        const options = {
            format: 'png',        // 이미지 형식
            out_dir: outputDir,   // 출력 디렉토리
            out_prefix: 'page',   // 파일명 접두사 (page-1.png, page-2.png, ...)
            page: null,           // 모든 페이지 (특정 페이지: 1, 2, 3...)
            // scale: 1024,       // 해상도 (기본값 사용)
        };

        console.log('변환 옵션:', options);

        // PDF → PNG 변환
        const result = await pdf.convert(pdfPath, options);
        console.log('변환 완료:', result);

        // 생성된 이미지 파일들 찾기
        const imageFiles = fs.readdirSync(outputDir)
            .filter(file => file.startsWith('page') && file.endsWith('.png'))
            .map(file => path.join(outputDir, file))
            .sort(); // 페이지 순서대로 정렬

        console.log(`${imageFiles.length}개 이미지 추출 완료:`, imageFiles);

        return imageFiles;

    } catch (error) {
        console.error('PDF 이미지 추출 오류:', error);
        throw new Error(`PDF 이미지 추출 실패: ${error.message}`);
    }
}

/**
 * 이미지가 다이어그램/차트인지 간단히 판단하는 함수
 * (나중에 더 정교하게 개선 가능)
 * @param {string} imagePath - 이미지 파일 경로
 * @returns {boolean} 다이어그램 여부
 */
function isLikelyChart(imagePath) {
    // 현재는 모든 이미지를 차트로 간주 (프로토타입)
    // 나중에 이미지 분석 로직 추가 가능:
    // - 텍스트 밀도 분석
    // - 직선/도형 감지
    // - 색상 분포 분석 등
    return true;
}

/**
 * 임시 이미지 파일들 정리
 * @param {string} outputDir - 정리할 디렉토리
 */
function cleanupTempImages(outputDir = './temp/pdf-images') {
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
