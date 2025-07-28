import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testCaseId = parseInt(id);

    if (isNaN(testCaseId)) {
      return NextResponse.json({ error: 'Invalid test case ID' }, { status: 400 });
    }

    const testCase = db.prepare(`
      SELECT 
        tc.*,
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
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: testCase });
  } catch (error) {
    console.error('Error fetching test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testCaseId = parseInt(id);
    const body = await request.json();

    console.log('PUT request - testCaseId:', testCaseId, 'body:', body);

    if (isNaN(testCaseId)) {
      return NextResponse.json({ error: 'Invalid test case ID' }, { status: 400 });
    }

    // Check if test case exists
    const existingTestCase = db.prepare('SELECT id FROM test_cases WHERE id = ?').get(testCaseId);
    console.log('Existing test case:', existingTestCase);
    
    if (!existingTestCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    // Build update query dynamically based on provided fields
    const updateFields = [];
    const updateValues = [];

    const allowedFields = ['title', 'description', 'steps', 'expected_results', 'actual_results', 'status', 'priority', 'tags'];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(body[field]);
      }
    }

    console.log('Update fields:', updateFields);
    console.log('Update values:', updateValues);

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updateValues.push(testCaseId);

    const updateQuery = `
      UPDATE test_cases 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    console.log('Update query:', updateQuery);

    const result = db.prepare(updateQuery).run(...updateValues);
    console.log('Update result:', result);

    if (result.changes > 0) {
      return NextResponse.json({ success: true, message: 'Test case updated successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to update test case' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testCaseId = parseInt(id);

    if (isNaN(testCaseId)) {
      return NextResponse.json({ error: 'Invalid test case ID' }, { status: 400 });
    }

    // Check if test case exists
    const existingTestCase = db.prepare('SELECT id FROM test_cases WHERE id = ?').get(testCaseId);
    if (!existingTestCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const result = db.prepare('DELETE FROM test_cases WHERE id = ?').run(testCaseId);

    if (result.changes > 0) {
      return NextResponse.json({ success: true, message: 'Test case deleted successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to delete test case' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}