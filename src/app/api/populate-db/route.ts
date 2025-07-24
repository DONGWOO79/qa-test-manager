import { NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function POST() {
  try {
    // Insert sample users
    const user1 = db.prepare(`
      INSERT INTO users (username, email, password_hash, role) 
      VALUES (?, ?, ?, ?)
    `).run('admin', 'admin@example.com', 'hashed_password', 'admin');

    const user2 = db.prepare(`
      INSERT INTO users (username, email, password_hash, role) 
      VALUES (?, ?, ?, ?)
    `).run('tester1', 'tester1@example.com', 'hashed_password', 'test_engineer');

    // Insert sample project
    const project1 = db.prepare(`
      INSERT INTO projects (name, description, test_leader_id, test_engineer_id, server, device, start_date, end_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('QA Test Project', 'Sample QA testing project', user1.lastInsertRowid, user2.lastInsertRowid, 'QA Server', 'Chrome Browser', '2024-01-01', '2024-12-31');

    // Insert sample test categories
    const category1 = db.prepare(`
      INSERT INTO test_categories (name, description, project_id) 
      VALUES (?, ?, ?)
    `).run('로그인 테스트', '사용자 인증 관련 테스트', project1.lastInsertRowid);

    const category2 = db.prepare(`
      INSERT INTO test_categories (name, description, project_id) 
      VALUES (?, ?, ?)
    `).run('회원가입 테스트', '새 사용자 등록 테스트', project1.lastInsertRowid);

    // Insert sample test cases
    const testCase1 = db.prepare(`
      INSERT INTO test_cases (title, description, category_id, project_id, priority, status, expected_result, created_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('정상 로그인 테스트', '올바른 사용자명과 비밀번호로 로그인', category1.lastInsertRowid, project1.lastInsertRowid, 'high', 'active', '로그인 성공', user1.lastInsertRowid);

    const testCase2 = db.prepare(`
      INSERT INTO test_cases (title, description, category_id, project_id, priority, status, expected_result, created_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('잘못된 비밀번호 로그인 테스트', '잘못된 비밀번호로 로그인 시도', category1.lastInsertRowid, project1.lastInsertRowid, 'medium', 'active', '로그인 실패 메시지 표시', user1.lastInsertRowid);

    const testCase3 = db.prepare(`
      INSERT INTO test_cases (title, description, category_id, project_id, priority, status, expected_result, created_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('회원가입 양식 테스트', '새 사용자 회원가입 양식 검증', category2.lastInsertRowid, project1.lastInsertRowid, 'high', 'active', '회원가입 성공', user2.lastInsertRowid);

    return NextResponse.json({ 
      success: true, 
      message: 'Database populated successfully',
      created: {
        users: 2,
        projects: 1,
        categories: 2,
        testCases: 3
      }
    });
  } catch (error) {
    console.error('Error populating database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to populate database' },
      { status: 500 }
    );
  }
}
