import { NextRequest, NextResponse } from 'next/server';
// import { withAuth } from '@/lib/auth/middleware'; // 임시로 주석 처리
import * as XLSX from 'xlsx';
import db from '@/lib/db/database';

// export const GET = withAuth(async (request: NextRequest) => {
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type') || 'test-cases';

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    let data: any[] = [];
    let fileName = '';

    if (type === 'test-cases') {
      // 테스트 케이스 데이터 조회
      data = db.prepare(`
        SELECT 
          tc.title,
          tc.description,
          tc.priority,
          tc.status,
          tc.expected_result,
          tcat.name as category,
          u.username as created_by,
          tc.created_at
        FROM test_cases tc
        LEFT JOIN test_categories tcat ON tc.category_id = tcat.id
        LEFT JOIN users u ON tc.created_by = u.id
        WHERE tc.project_id = ?
        ORDER BY tc.created_at DESC
      `).all(projectId);

      fileName = `test-cases-${projectId}-${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (type === 'test-results') {
      // 테스트 결과 데이터 조회
      data = db.prepare(`
        SELECT 
          tc.title,
          tc.priority,
          tc.status,
          tr.status as execution_status,
          tr.executed_by,
          tr.executed_at,
          tr.notes
        FROM test_cases tc
        LEFT JOIN test_runs tr ON tc.id = tr.test_case_id
        WHERE tc.project_id = ?
        ORDER BY tr.executed_at DESC
      `).all(projectId);

      fileName = `test-results-${projectId}-${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    // Excel 파일 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, type === 'test-cases' ? '테스트 케이스' : '테스트 결과');

    // 파일 생성
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { success: false, error: '엑셀 파일 export에 실패했습니다.' },
      { status: 500 }
    );
  }
}
// });
