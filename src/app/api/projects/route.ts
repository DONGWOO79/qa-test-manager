import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET() {
  try {
    const projects = db.prepare(`
      SELECT 
        p.*,
        tl.username as test_leader_name,
        te.username as test_engineer_name
      FROM projects p
      LEFT JOIN users tl ON p.test_leader_id = tl.id
      LEFT JOIN users te ON p.test_engineer_id = te.id
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
    const {
      name,
      description,
      test_leader_id,
      test_engineer_id,
      server,
      device,
      start_date,
      end_date
    } = body;

    const result = db.prepare(`
      INSERT INTO projects (
        name, description, test_leader_id, test_engineer_id,
        server, device, start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description, test_leader_id, test_engineer_id, server, device, start_date, end_date);

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
