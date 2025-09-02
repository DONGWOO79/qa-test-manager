import Database from 'better-sqlite3';
import path from 'path';

// 데이터베이스 파일 경로 설정
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'qa_test_manager.db')
  : path.join(process.cwd(), 'database.db');

// 데이터베이스 연결
const db = new Database(dbPath);

// 데이터베이스 초기화 함수
export function initializeDatabase() {
  console.log('Starting database initialization...');
  
  // 사용자 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'test_leader', 'test_engineer')) DEFAULT 'test_engineer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Users table created/verified');

  // 프로젝트 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('active', 'completed', 'archived')) DEFAULT 'active',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);
  console.log('Projects table created/verified');

  // 테스트 카테고리 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (parent_id) REFERENCES test_categories (id)
    )
  `);

  // 테스트 케이스 테이블 (status 필드 수정)
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      priority TEXT CHECK(priority IN ('high', 'medium', 'low', 'critical')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('draft', 'active', 'deprecated', 'pass', 'fail', 'na', 'not_run', 'in_progress', 'passed', 'failed', 'blocked', 'skipped')) DEFAULT 'draft',
      expected_result TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES test_categories (id),
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // 테스트 스텝 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id INTEGER NOT NULL,
      step_number INTEGER NOT NULL,
      action TEXT NOT NULL,
      expected_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_case_id) REFERENCES test_cases (id) ON DELETE CASCADE
    )
  `);

  // 테스트 템플릿 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES test_categories (id),
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // 테스트 실행 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('planned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'planned',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // 테스트 실행 결과 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_run_id INTEGER NOT NULL,
      test_case_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('pass', 'fail', 'na', 'not_run', 'blocked')) DEFAULT 'not_run',
      executed_by INTEGER,
      executed_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_run_id) REFERENCES test_runs (id) ON DELETE CASCADE,
      FOREIGN KEY (test_case_id) REFERENCES test_cases (id) ON DELETE CASCADE,
      FOREIGN KEY (executed_by) REFERENCES users (id)
    )
  `);

  console.log('Database initialized successfully');
}

// 데이터베이스 인스턴스 내보내기
export default db;
