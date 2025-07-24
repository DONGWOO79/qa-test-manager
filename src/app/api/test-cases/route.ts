import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const categoryId = searchParams.get('categoryId');

    let query = `
      SELECT 
        tc.*,
        tc.name as category_name,
        u.username as created_by_name
      FROM test_cases tc
      LEFT JOIN test_categories tc ON tc.category_id = tc.id
      LEFT JOIN users u ON tc.created_by = u.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (projectId) {
      conditions.push('tc.project_id = ?');
      params.push(projectId);
    }

    if (categoryId) {
      conditions.push('tc.category_id = ?');
      params.push(categoryId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY tc.created_at DESC';

    const testCases = db.prepare(query).all(params);

    // 각 테스트 케이스의 스텝들도 가져오기
    for (const testCase of testCases) {
      const steps = db.prepare(`
        SELECT * FROM test_steps 
        WHERE test_case_id = ? 
        ORDER BY step_number
      `).all(testCase.id);
      testCase.steps = steps;
    }

    return NextResponse.json({ success: true, data: testCases });
  } catch (error) {
    console.error('Error fetching test cases:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch test cases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      category_id,
      project_id,
      priority,
      expected_result,
      steps,
      created_by
    } = body;

    // 트랜잭션 시작
    const transaction = db.transaction(() => {
      // 테스트 케이스 생성
      const result = db.prepare(`
        INSERT INTO test_cases (
          title, description, category_id, project_id, priority, 
          expected_result, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(title, description, category_id, project_id, priority, expected_result, created_by);

      const testCaseId = result.lastInsertRowid;

      // 테스트 스텝들 생성
      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          db.prepare(`
            INSERT INTO test_steps (
              test_case_id, step_number, action, expected_result
            ) VALUES (?, ?, ?, ?)
          `).run(testCaseId, i + 1, step.action, step.expected_result);
        }
      }

      return testCaseId;
    });

    const testCaseId = transaction();

    return NextResponse.json({ 
      success: true, 
      data: { id: testCaseId },
      message: 'Test case created successfully' 
    });
  } catch (error) {
    console.error('Error creating test case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create test case' },
      { status: 500 }
    );
  }
}
