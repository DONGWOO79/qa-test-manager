import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import db from '@/lib/db/database';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop();

    const testCase = db.prepare(`
      SELECT 
        tc.*,
        cat.name as category_name,
        u.username as created_by_name
      FROM test_cases tc
      LEFT JOIN test_categories cat ON tc.category_id = cat.id
      LEFT JOIN users u ON tc.created_by = u.id
      WHERE tc.id = ?
    `).get(id);

    if (!testCase) {
      return NextResponse.json(
        { success: false, error: 'Test case not found' },
        { status: 404 }
      );
    }

    // 테스트 스텝들 가져오기
    const steps = db.prepare(`
      SELECT * FROM test_steps 
      WHERE test_case_id = ? 
      ORDER BY step_number
    `).all(id);

    testCase.steps = steps;

    return NextResponse.json({ success: true, data: testCase });
  } catch (error) {
    console.error('Error fetching test case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch test case' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop();
    const body = await request.json();
    const {
      title,
      description,
      category_id,
      priority,
      expected_result,
      steps
    } = body;

    // 테스트 케이스 존재 확인
    const existingTestCase = db.prepare(`
      SELECT id FROM test_cases WHERE id = ?
    `).get(id);

    if (!existingTestCase) {
      return NextResponse.json(
        { success: false, error: 'Test case not found' },
        { status: 404 }
      );
    }

    // 트랜잭션으로 업데이트
    const transaction = db.transaction(() => {
      // 테스트 케이스 업데이트
      db.prepare(`
        UPDATE test_cases 
        SET title = ?, description = ?, category_id = ?, priority = ?, 
            expected_result = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(title, description, category_id, priority, expected_result, id);

      // 기존 스텝들 삭제
      db.prepare(`
        DELETE FROM test_steps WHERE test_case_id = ?
      `).run(id);

      // 새 스텝들 추가
      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          db.prepare(`
            INSERT INTO test_steps (
              test_case_id, step_number, action, expected_result
            ) VALUES (?, ?, ?, ?)
          `).run(id, i + 1, step.action, step.expected_result);
        }
      }
    });

    transaction();

    return NextResponse.json({ 
      success: true, 
      message: 'Test case updated successfully' 
    });
  } catch (error) {
    console.error('Error updating test case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update test case' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop();

    // 테스트 케이스 존재 확인
    const existingTestCase = db.prepare(`
      SELECT id FROM test_cases WHERE id = ?
    `).get(id);

    if (!existingTestCase) {
      return NextResponse.json(
        { success: false, error: 'Test case not found' },
        { status: 404 }
      );
    }

    // 트랜잭션으로 삭제 (CASCADE로 스텝들도 자동 삭제됨)
    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM test_cases WHERE id = ?
      `).run(id);
    });

    transaction();

    return NextResponse.json({ 
      success: true, 
      message: 'Test case deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete test case' },
      { status: 500 }
    );
  }
});
