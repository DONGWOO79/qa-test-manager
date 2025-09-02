import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.db');

export async function POST() {
  try {
    const db = new Database(dbPath);
    
    // 간단한 테스트케이스 생성
    const testCase = {
      title: '간단한 테스트케이스',
      description: '테스트 설명',
      category_id: 2, // 실제 존재하는 카테고리 ID
      priority: 'medium',
      status: 'draft',
      project_id: 5,
      created_by: 1
    };
    
    const stmt = db.prepare(`
      INSERT INTO test_cases (
        title, description, category_id, priority, status, 
        project_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const result = stmt.run(
      testCase.title,
      testCase.description,
      testCase.category_id,
      testCase.priority,
      testCase.status,
      testCase.project_id,
      testCase.created_by
    );
    
    return NextResponse.json({
      success: true,
      message: '테스트케이스가 성공적으로 생성되었습니다.',
      result: result
    });
    
  } catch (error) {
    console.error('테스트 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
