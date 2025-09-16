import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    let query = `
      SELECT 
        tc.id,
        tc.title,
        tc.description,
        tc.test_strategy,
        tc.priority,
        tc.status,
        tc.expected_result,
        tc.created_at,
        tc.updated_at,
        tc.page_numbers,
        tcat.name as category_name,
        p.name as project_name,
        u.username as created_by_name
      FROM test_cases tc
      LEFT JOIN test_categories tcat ON tc.category_id = tcat.id
      LEFT JOIN projects p ON tc.project_id = p.id
      LEFT JOIN users u ON tc.created_by = u.id
    `;

    const params: any[] = [];

    if (projectId) {
      query += ' WHERE tc.project_id = ?';
      params.push(projectId);
    }

    query += ' ORDER BY tc.created_at DESC';

    const testCases = db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      data: testCases
    });

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
    const { title, description, category_id, project_id, priority, expected_result, status } = body;

    if (!title || !project_id) {
      return NextResponse.json(
        { success: false, error: 'Title and project_id are required' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      INSERT INTO test_cases (
        title, description, category_id, project_id, priority, 
        expected_result, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      description || '',
      category_id || null,
      project_id,
      priority || 'medium',
      expected_result || '',
      status || 'draft',
      1 // 임시 사용자 ID
    );

    return NextResponse.json({
      success: true,
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('Error creating test case:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create test case' },
      { status: 500 }
    );
  }
}
