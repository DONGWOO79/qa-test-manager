import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type') || 'test-cases';

    let data: any[] = [];
    let fileName = '';

    if (type === 'test-cases') {
      // 테스트 케이스 데이터 가져오기
      const testCases = db.prepare(`
        SELECT 
          tc.id,
          tc.title,
          tc.description,
          tc.priority,
          tc.status,
          tc.expected_result,
          tc.created_at,
          tcat.name as category_name,
          p.name as project_name,
          u.username as created_by_name
        FROM test_cases tc
        LEFT JOIN test_categories tcat ON tc.category_id = tcat.id
        LEFT JOIN projects p ON tc.project_id = p.id
        LEFT JOIN users u ON tc.created_by = u.id
        ${projectId ? 'WHERE tc.project_id = ?' : ''}
        ORDER BY tc.created_at DESC
      `).all(projectId ? [projectId] : []);

      data = testCases.map(tc => ({
        'TC ID': tc.id,
        '제목': tc.title,
        '설명': tc.description,
        '카테고리': tc.category_name,
        '프로젝트': tc.project_name,
        '우선순위': tc.priority,
        '상태': tc.status,
        '기대결과': tc.expected_result,
        '작성자': tc.created_by_name,
        '작성일': new Date(tc.created_at).toLocaleDateString('ko-KR')
      }));

      fileName = `qa-test-cases-${projectId || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (type === 'statistics') {
      // 통계 데이터 가져오기
      const stats = db.prepare(`
        SELECT 
          p.name as project_name,
          COUNT(*) as total_cases,
          SUM(CASE WHEN tc.status = 'pass' THEN 1 ELSE 0 END) as pass_count,
          SUM(CASE WHEN tc.status = 'fail' THEN 1 ELSE 0 END) as fail_count,
          SUM(CASE WHEN tc.status = 'na' THEN 1 ELSE 0 END) as na_count,
          SUM(CASE WHEN tc.status = 'not_run' THEN 1 ELSE 0 END) as not_run_count
        FROM test_cases tc
        JOIN projects p ON tc.project_id = p.id
        ${projectId ? 'WHERE tc.project_id = ?' : ''}
        GROUP BY p.id, p.name
      `).all(projectId ? [projectId] : []);

      data = stats.map(stat => ({
        '프로젝트': stat.project_name,
        '총 테스트케이스': stat.total_cases,
        '통과': stat.pass_count,
        '실패': stat.fail_count,
        '해당없음': stat.na_count,
        '미실행': stat.not_run_count,
        '통과율': stat.total_cases > 0 ? `${((stat.pass_count / stat.total_cases) * 100).toFixed(1)}%` : '0%'
      }));

      fileName = `qa-report-${projectId || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    // Excel 워크북 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 컬럼 너비 자동 조정
    const columnWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    worksheet['!cols'] = columnWidths;

    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, type === 'test-cases' ? '테스트케이스' : '통계');

    // Excel 파일 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: headers
    });

  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { success: false, error: 'Excel 파일 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
