import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = id;

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = id;
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    // 트랜잭션 시작 - 프로젝트와 관련 테스트케이스 모두 삭제
    const transaction = db.transaction(() => {
      // 1. 해당 프로젝트의 모든 테스트케이스 삭제
      const deleteTestCases = db.prepare(`
        DELETE FROM test_cases WHERE project_id = ?
      `);
      const testCasesResult = deleteTestCases.run(projectId);

      // 2. 프로젝트 삭제
      const deleteProject = db.prepare(`
        DELETE FROM projects WHERE id = ?
      `);
      const projectResult = deleteProject.run(projectId);

      return {
        deletedTestCases: testCasesResult.changes,
        deletedProject: projectResult.changes
      };
    });

    const result = transaction();

    if (result.deletedProject === 0) {
      return NextResponse.json(
        { success: false, error: "삭제할 프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "프로젝트와 관련 데이터가 성공적으로 삭제되었습니다.",
      data: {
        deletedTestCases: result.deletedTestCases,
        deletedProject: result.deletedProject
      }
    });

  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { success: false, error: "프로젝트 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}