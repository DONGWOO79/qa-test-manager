import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'qa_test_manager.db');
const db = new Database(dbPath);

// 데이터베이스 초기화
export function initializeDatabase() {
  // 사용자 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'test_leader', 'test_engineer')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 프로젝트 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      test_leader_id INTEGER NOT NULL,
      test_engineer_id INTEGER NOT NULL,
      server TEXT NOT NULL,
      device TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT CHECK(status IN ('active', 'completed', 'on_hold')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_leader_id) REFERENCES users (id),
      FOREIGN KEY (test_engineer_id) REFERENCES users (id)
    )
  `);

  // 테스트 카테고리 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      project_id INTEGER NOT NULL,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (parent_id) REFERENCES test_categories (id)
    )
  `);

  // 테스트 케이스 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('draft', 'active', 'deprecated')) DEFAULT 'draft',
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
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES test_categories (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // 템플릿 변수 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS template_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      default_value TEXT,
      required BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES test_templates (id) ON DELETE CASCADE
    )
  `);

  // 테스트 실행 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      executed_by INTEGER NOT NULL,
      status TEXT CHECK(status IN ('pass', 'fail', 'na', 'holding')) NOT NULL,
      notes TEXT,
      execution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_case_id) REFERENCES test_cases (id),
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (executed_by) REFERENCES users (id)
    )
  `);

  // 테스트 실행 상세 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_run_id INTEGER NOT NULL,
      test_step_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('pass', 'fail', 'na')) NOT NULL,
      notes TEXT,
      execution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_run_id) REFERENCES test_runs (id) ON DELETE CASCADE,
      FOREIGN KEY (test_step_id) REFERENCES test_steps (id)
    )
  `);

  console.log('Database initialized successfully');
}

// 데이터베이스 인스턴스 내보내기
export default db;
