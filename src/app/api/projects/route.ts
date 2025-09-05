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
    const { name, description, status = 'active' } = body;

    // 기본 사용자 ID 확인 및 생성
    let userId = db.prepare('SELECT id FROM users WHERE role = ?').get('admin')?.id;
    
    if (!userId) {
      // 기본 사용자가 없으면 생성
      const insertUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, role) 
        VALUES (?, ?, ?, ?)
      `);
      const userResult = insertUser.run('admin', 'admin@test.com', 'hashed_password', 'admin');
      userId = userResult.lastInsertRowid;
    }

    const result = db.prepare(`
      INSERT INTO projects (
        name, description, status, created_by
      ) VALUES (?, ?, ?, ?)
    `).run(name, description, status, userId);

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
