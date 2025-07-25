import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    const project = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.created_at,
        p.updated_at,
        u.username as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(projectId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();
    const { name, description, status } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      UPDATE projects 
      SET name = ?, description = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, description || '', status || 'active', projectId);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Project updated successfully'
    });

  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Check if project has test cases
    const testCaseCount = db.prepare(`
      SELECT COUNT(*) as count FROM test_cases WHERE project_id = ?
    `).get(projectId);

    if (testCaseCount.count > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete project with test cases' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      DELETE FROM projects WHERE id = ?
    `).run(projectId);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
