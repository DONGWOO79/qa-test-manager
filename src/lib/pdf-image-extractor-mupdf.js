const { spawn } = require('child_process');
const { tmpdir } = require('os');
const { mkdtempSync, readFileSync, existsSync, rmSync } = require('fs');
const { join } = require('path');

/**
 * MuPDF mutool을 사용한 PDF 이미지 추출
 * 피그마 PDF의 벡터/투명도/블렌딩을 정확히 처리
 */
async function extractImagesFromPDF(pdfPath, dpi = 300) {
    console.log(`MuPDF 이미지 추출 시작: ${pdfPath}`);

    // 임시 디렉토리 생성
    const tempDir = mkdtempSync(join(tmpdir(), 'mupdf-extract-'));
    const outputPattern = join(tempDir, 'page-%03d.png');

    console.log(`📁 임시 디렉토리: ${tempDir}`);
    console.log(`🎯 해상도: ${dpi} DPI (한국어 OCR 최적화)`);

    try {
        // mutool draw 명령어 실행
        const args = [
            'draw',
            '-r', String(dpi),           // 해상도 설정
            '-o', outputPattern,         // 출력 패턴
            pdfPath                      // 입력 PDF
        ];

        console.log(`🚀 mutool 실행: mutool ${args.join(' ')}`);

        await new Promise((resolve, reject) => {
            const process = spawn('mutool', args);

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('error', (error) => {
                console.error('❌ mutool 프로세스 오류:', error.message);
                reject(new Error(`MuPDF 프로세스 실행 실패: ${error.message}`));
            });

            process.on('close', (code) => {
                if (stdout.trim()) {
                    console.log('📋 mutool 출력:', stdout.trim());
                }
                if (stderr.trim()) {
                    console.log('⚠️ mutool 경고:', stderr.trim());
                }

                if (code === 0) {
                    console.log('✅ mutool 실행 완료');
                    resolve();
                } else {
                    console.error(`❌ mutool 종료 코드: ${code}`);
                    reject(new Error(`MuPDF 실행 실패 (종료 코드: ${code})`));
                }
            });
        });

        // 생성된 이미지 파일들 수집
        const imageFiles = [];
        let pageNum = 1;

        while (true) {
            const imagePath = join(tempDir, `page-${String(pageNum).padStart(3, '0')}.png`);

            if (!existsSync(imagePath)) {
                break;
            }

            const stats = require('fs').statSync(imagePath);
            const sizeKB = Math.round(stats.size / 1024);

            console.log(`📄 페이지 ${pageNum}: ${imagePath} (${sizeKB}KB)`);

            // 빈 이미지 검증 (10KB 미만이면 의심스러움)
            if (stats.size < 10 * 1024) {
                console.warn(`⚠️ 페이지 ${pageNum}: 이미지가 너무 작음 (${sizeKB}KB) - 빈 이미지 의심`);
            }

            imageFiles.push(imagePath);
            pageNum++;
        }

        // 결과 요약
        console.log(`\\n📊 MuPDF 이미지 추출 완료:`);
        console.log(`   ✅ 성공: ${imageFiles.length}페이지`);
        console.log(`   📁 위치: ${tempDir}`);

        if (imageFiles.length === 0) {
            throw new Error('이미지 추출 실패: 생성된 파일이 없습니다');
        }

        return imageFiles;

    } catch (error) {
        // 임시 디렉토리 정리
        try {
            rmSync(tempDir, { recursive: true, force: true });
            console.log('🧹 임시 디렉토리 정리 완료');
        } catch (cleanupError) {
            console.warn('⚠️ 임시 디렉토리 정리 실패:', cleanupError.message);
        }

        throw error;
    }
}

/**
 * MuPDF로 PDF를 PNG 버퍼 배열로 변환
 * Google Vision API에 바로 전달할 수 있는 형태
 */
async function pdfToPngBuffers(pdfPath, dpi = 300) {
    const imagePaths = await extractImagesFromPDF(pdfPath, dpi);
    const buffers = [];

    try {
        for (const imagePath of imagePaths) {
            const buffer = readFileSync(imagePath);
            buffers.push(buffer);
        }

        console.log(`📦 ${buffers.length}개 이미지를 버퍼로 변환 완료`);
        return buffers;

    } finally {
        // 임시 파일들 정리
        try {
            const tempDir = require('path').dirname(imagePaths[0]);
            rmSync(tempDir, { recursive: true, force: true });
            console.log('🧹 MuPDF 임시 파일 정리 완료');
        } catch (cleanupError) {
            console.warn('⚠️ MuPDF 임시 파일 정리 실패:', cleanupError.message);
        }
    }
}

module.exports = {
    extractImagesFromPDF,
    pdfToPngBuffers
};

