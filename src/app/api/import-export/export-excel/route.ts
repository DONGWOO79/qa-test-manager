import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import * as XLSX from 'xlsx';
import db from '@/lib/db/database';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type') || 'test-cases'; // test-cases, test-results

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    let data: any[] = [];

    if (type === 'test-cases') {
      // 테스트 케이스 데이터 조회
      const testCases = db.prepare(`
        SELECT 
          tc.title,
          tc.description,
          tc.priority,
          tc.expected_result,
          cat.name as category,
          u.username as created_by,
          tc.created_at
        FROM test_cases tc
        LEFT JOIN test_categories cat ON tc.category_id = cat.id
        LEFT JOIN users u ON tc.created_by = u.id
        WHERE tc.project_id = ?
        ORDER BY cat.name, tc.created_at
      `).all(projectId);

      // 각 테스트 케이스의 스텝 정보도 포함
      for (const testCase of testCases) {
        const steps = db.prepare(`
          SELECT step_number, action, expected_result
          FROM test_steps
          WHERE test_case_id = (
            SELECT id FROM test_cases 
            WHERE title = ? AND project_id = ?
          )
          ORDER BY step_number
        `).all(testCase.title, projectId);

        testCase.steps = steps.map(step => 
          `${step.step_number}. ${step.action}${step.expected_result ? ` (예상: ${step.expected_result})` : ''}`
        ).join('; ');
      }

      data = testCases;
    } else if (type === 'test-results') {
      // 테스트 결과 데이터 조회
      data = db.prepare(`
        SELECT 
          tc.title as test_case_title,
          cat.name as category,
          tr.status,
          tr.notes,
          u.username as executed_by,
          tr.execution_date,
          tc.priority
        FROM test_runs tr
        LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
        LEFT JOIN test_categories cat ON tc.category_id = cat.id
        LEFT JOIN users u ON tr.executed_by = u.id
        WHERE tr.project_id = ?
        ORDER BY tr.execution_date DESC
      `).all(projectId);
    }

    if (data.length === 0) {
      return NextResponse.json(
        { success: false, error: '내보낼 데이터가 없습니다.' },
        { status: 404 }
      );
    }

    // 워크북 생성
    const workbook = XLSX.utils.book_new();
    
    // 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 컬럼 너비 자동 조정
    const columnWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
    }));
    worksheet['!cols'] = columnWidths;

    // 워크시트를 워크북에 추가
    const sheetName = type === 'test-cases' ? '테스트케이스' : '테스트결과';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // 통계 시트 추가
    if (type === 'test-results') {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass,
          SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail,
          SUM(CASE WHEN status = 'na' THEN 1 ELSE 0 END) as na,
          SUM(CASE WHEN status = 'holding' THEN 1 ELSE 0 END) as holding
        FROM test_runs
        WHERE project_id = ?
      `).get(projectId);

      const statsData = [
        { 항목: '총 테스트 수', 값: stats.total },
        { 항목: '통과', 값: stats.pass, 비율: `${((stats.pass / stats.total) * 100).toFixed(1)}%` },
        { 항목: '실패', 값: stats.fail, 비율: `${((stats.fail / stats.total) * 100).toFixed(1)}%` },
        { 항목: '해당없음', 값: stats.na, 비율: `${((stats.na / stats.total) * 100).toFixed(1)}%` },
        { 항목: '보류', 값: stats.holding, 비율: `${((stats.holding / stats.total) * 100).toFixed(1)}%` },
        { 항목: '통과율', 값: `${((stats.pass / stats.total) * 100).toFixed(1)}%` }
      ];

      const statsWorksheet = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(workbook, statsWorksheet, '통계');
    }

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 응답 헤더 설정
    const fileName = `qa-${type}-${projectId}-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(excelBuffer, {
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
});
