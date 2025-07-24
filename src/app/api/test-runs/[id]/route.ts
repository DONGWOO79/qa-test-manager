import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import db from '@/lib/db/database';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop();

    const testRun = db.prepare(`
      SELECT 
        tr.*,
        tc.title as test_case_title,
        tc.description as test_case_description,
        u.username as executed_by_name
      FROM test_runs tr
      LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
      LEFT JOIN users u ON tr.executed_by = u.id
      WHERE tr.id = ?
    `).get(id);

    if (!testRun) {
      return NextResponse.json(
        { success: false, error: 'Test run not found' },
        { status: 404 }
      );
    }

    // 테스트 실행 상세 정보 가져오기
    const executions = db.prepare(`
      SELECT 
        te.*,
        ts.step_number,
        ts.action,
        ts.expected_result
      FROM test_executions te
      LEFT JOIN test_steps ts ON te.test_step_id = ts.id
      WHERE te.test_run_id = ?
      ORDER BY ts.step_number
    `).all(id);

    testRun.executions = executions;

    return NextResponse.json({ success: true, data: testRun });
  } catch (error) {
    console.error('Error fetching test run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch test run' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop();
    const body = await request.json();
    const { status, notes } = body;

    // 테스트 실행 존재 확인
    const existingTestRun = db.prepare(`
      SELECT id FROM test_runs WHERE id = ?
    `).get(id);

    if (!existingTestRun) {
      return NextResponse.json(
        { success: false, error: 'Test run not found' },
        { status: 404 }
      );
    }

    // 테스트 실행 업데이트
    db.prepare(`
      UPDATE test_runs 
      SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, notes, id);

    return NextResponse.json({ 
      success: true, 
      message: 'Test run updated successfully' 
    });
  } catch (error) {
    console.error('Error updating test run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update test run' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop();

    // 테스트 실행 존재 확인
    const existingTestRun = db.prepare(`
      SELECT id FROM test_runs WHERE id = ?
    `).get(id);

    if (!existingTestRun) {
      return NextResponse.json(
        { success: false, error: 'Test run not found' },
        { status: 404 }
      );
    }

    // 트랜잭션으로 삭제
    const transaction = db.transaction(() => {
      // 테스트 실행 상세 정보 삭제
      db.prepare(`
        DELETE FROM test_executions WHERE test_run_id = ?
      `).run(id);

      // 테스트 실행 삭제
      db.prepare(`
        DELETE FROM test_runs WHERE id = ?
      `).run(id);
    });

    transaction();

    return NextResponse.json({ 
      success: true, 
      message: 'Test run deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting test run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete test run' },
      { status: 500 }
    );
  }
});
