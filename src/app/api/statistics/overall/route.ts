import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    // Get project statistics
    const projectStats = db.prepare(`
      SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects
      FROM projects
    `).get();

    // Get test case statistics
    const testCaseStats = db.prepare(`
      SELECT 
        COUNT(*) as total_test_cases,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as completed_test_cases,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            ROUND((SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 1)
          ELSE 0 
        END as pass_rate
      FROM test_cases
    `).get();

    const statistics = {
      totalProjects: projectStats.total_projects || 0,
      activeProjects: projectStats.active_projects || 0,
      totalTestCases: testCaseStats.total_test_cases || 0,
      completedTestCases: testCaseStats.completed_test_cases || 0,
      passRate: testCaseStats.pass_rate || 0
    };

    return NextResponse.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('Error fetching overall statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
