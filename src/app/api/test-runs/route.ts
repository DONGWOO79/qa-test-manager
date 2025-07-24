import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import db from '@/lib/db/database';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');

    let query = `
      SELECT 
        tr.*,
        tc.title as test_case_title,
        u.username as executed_by_name
      FROM test_runs tr
      LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
      LEFT JOIN users u ON tr.executed_by = u.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (projectId) {
      conditions.push('tr.project_id = ?');
      params.push(projectId);
    }

    if (status) {
      conditions.push('tr.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY tr.execution_date DESC';

    const testRuns = db.prepare(query).all(params);

    return NextResponse.json({ success: true, data: testRuns });
  } catch (error) {
    console.error('Error fetching test runs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch test runs' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      test_case_id,
      project_id,
      status,
      notes
    } = body;

    const { user } = request as any;

    const result = db.prepare(`
      INSERT INTO test_runs (
        test_case_id, project_id, executed_by, status, notes
      ) VALUES (?, ?, ?, ?, ?)
    `).run(test_case_id, project_id, user.id, status, notes);

    return NextResponse.json({ 
      success: true, 
      data: { id: result.lastInsertRowid },
      message: 'Test run created successfully' 
    });
  } catch (error) {
    console.error('Error creating test run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create test run' },
      { status: 500 }
    );
  }
});
