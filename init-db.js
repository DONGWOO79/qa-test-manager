const Database = require('better-sqlite3');
const path = require('path');

// 데이터베이스 파일 경로 설정
const dbPath = path.join(process.cwd(), 'qa_test_manager_dev.db');
console.log('Database path:', dbPath);

// 데이터베이스 연결
const db = new Database(dbPath);

// 데이터베이스 초기화 함수
function initializeDatabase() {
  console.log('Initializing database...');
  
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

  // 테스트 케이스 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('draft', 'active', 'deprecated', 'pass', 'fail', 'na', 'not_run')) DEFAULT 'draft',
      expected_result TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES test_categories (id),
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // 기본 사용자 생성
  try {
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role) 
      VALUES (?, ?, ?, ?)
    `).run('admin', 'admin@test.com', 'dummy_hash', 'admin');
    console.log('Default user created');
  } catch (error) {
    console.log('User already exists or error:', error.message);
  }

  console.log('Database initialized successfully');
}

// 초기화 실행
initializeDatabase();
db.close();
