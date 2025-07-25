import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET() {
  try {
    const projects = db.prepare(`
      SELECT 
        p.*,
        u.username as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `).all();

    return NextResponse.json({ success: true, data: projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    // 임시로 기본 사용자 ID 사용 (개발용)
    const userId = 1;

    const result = db.prepare(`
      INSERT INTO projects (
        name, description, created_by
      ) VALUES (?, ?, ?)
    `).run(name, description, userId);

    return NextResponse.json({ 
      success: true, 
      data: { id: result.lastInsertRowid },
      message: 'Project created successfully' 
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
