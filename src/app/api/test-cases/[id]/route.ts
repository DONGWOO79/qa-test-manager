import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const testCaseId = params.id;

    // 테스트 케이스 정보 가져오기
    const testCase = db.prepare(`
      SELECT 
        tc.id,
        tc.title,
        tc.description,
        tc.priority,
        tc.status,
        tc.expected_result,
        tc.created_at,
        tc.updated_at,
        tcat.name as category_name,
        p.name as project_name,
        u.username as created_by_name
      FROM test_cases tc
      LEFT JOIN test_categories tcat ON tc.category_id = tcat.id
      LEFT JOIN projects p ON tc.project_id = p.id
      LEFT JOIN users u ON tc.created_by = u.id
      WHERE tc.id = ?
    `).get(testCaseId);

    if (!testCase) {
      return NextResponse.json(
        { success: false, error: 'Test case not found' },
        { status: 404 }
      );
    }

    // 테스트 스텝 가져오기
    const testSteps = db.prepare(`
      SELECT id, step_number, action, expected_result
      FROM test_steps
      WHERE test_case_id = ?
      ORDER BY step_number
    `).all(testCaseId);

    const result = {
      ...testCase,
      test_steps: testSteps
    };

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching test case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch test case' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const testCaseId = params.id;
    const body = await request.json();
    const { title, description, priority, status, expected_result } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      UPDATE test_cases 
      SET title = ?, description = ?, priority = ?, status = ?, 
          expected_result = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(title, description || '', priority || 'medium', 
           status || 'not_run', expected_result || '', testCaseId);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Test case not found' },
        { status: 404 }
      );
    }

    // 업데이트된 테스트 케이스 정보 반환
    const updatedTestCase = db.prepare(`
      SELECT 
        tc.id,
        tc.title,
        tc.description,
        tc.priority,
        tc.status,
        tc.expected_result,
        tc.created_at,
        tc.updated_at,
        tcat.name as category_name,
        p.name as project_name,
        u.username as created_by_name
      FROM test_cases tc
      LEFT JOIN test_categories tcat ON tc.category_id = tcat.id
      LEFT JOIN projects p ON tc.project_id = p.id
      LEFT JOIN users u ON tc.created_by = u.id
      WHERE tc.id = ?
    `).get(testCaseId);

    return NextResponse.json({
      success: true,
      data: updatedTestCase
    });

  } catch (error) {
    console.error('Error updating test case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update test case' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const testCaseId = params.id;

    // 테스트 스텝 먼저 삭제
    db.prepare(`
      DELETE FROM test_steps WHERE test_case_id = ?
    `).run(testCaseId);

    // 테스트 케이스 삭제
    const result = db.prepare(`
      DELETE FROM test_cases WHERE id = ?
    `).run(testCaseId);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Test case not found' },
        { status: 404 }
      );
    }

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
}
