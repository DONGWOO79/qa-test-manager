import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import * as XLSX from 'xlsx';
import db from '@/lib/db/database';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 검증
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, error: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일을 ArrayBuffer로 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 첫 번째 시트 읽기
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return NextResponse.json(
        { success: false, error: '엑셀 파일에 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const { user } = request as any;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 트랜잭션으로 데이터 import
    const transaction = db.transaction(() => {
      for (const row of jsonData as any[]) {
        try {
          // 필수 필드 검증
          if (!row.title || !row.category) {
            errors.push(`행 ${successCount + errorCount + 1}: 제목과 카테고리가 필요합니다.`);
            errorCount++;
            continue;
          }

          // 카테고리 찾기 또는 생성
          let categoryId = db.prepare(`
            SELECT id FROM test_categories 
            WHERE name = ? AND project_id = ?
          `).get(row.category, projectId);

          if (!categoryId) {
            const result = db.prepare(`
              INSERT INTO test_categories (name, project_id)
              VALUES (?, ?)
            `).run(row.category, projectId);
            categoryId = { id: result.lastInsertRowid };
          }

          // 테스트 케이스 생성
          const testCaseResult = db.prepare(`
            INSERT INTO test_cases (
              title, description, category_id, project_id, priority, 
              expected_result, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            row.title,
            row.description || '',
            categoryId.id,
            projectId,
            row.priority || 'medium',
            row.expected_result || '',
            user.id
          );

          const testCaseId = testCaseResult.lastInsertRowid;

          // 테스트 스텝 처리
          if (row.steps) {
            const steps = Array.isArray(row.steps) ? row.steps : [row.steps];
            for (let i = 0; i < steps.length; i++) {
              const step = steps[i];
              if (step.action) {
                db.prepare(`
                  INSERT INTO test_steps (
                    test_case_id, step_number, action, expected_result
                  ) VALUES (?, ?, ?, ?)
                `).run(testCaseId, i + 1, step.action, step.expected_result || '');
              }
            }
          }

          successCount++;
        } catch (error) {
          console.error('Import error for row:', row, error);
          errors.push(`행 ${successCount + errorCount + 1}: ${error}`);
          errorCount++;
        }
      }
    });

    transaction();

    return NextResponse.json({
      success: true,
      message: `Import 완료: ${successCount}개 성공, ${errorCount}개 실패`,
      data: {
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // 최대 10개 에러만 반환
      }
    });

  } catch (error) {
    console.error('Excel import error:', error);
    return NextResponse.json(
      { success: false, error: '엑셀 파일 import에 실패했습니다.' },
      { status: 500 }
    );
  }
});
