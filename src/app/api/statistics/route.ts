import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail,
        SUM(CASE WHEN status = 'na' THEN 1 ELSE 0 END) as na,
        SUM(CASE WHEN status = 'not_run' THEN 1 ELSE 0 END) as not_run,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            ROUND((SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 1)
          ELSE 0 
        END as pass_rate
      FROM test_cases
    `;

    const params: any[] = [];

    if (projectId) {
      query += ' WHERE project_id = ?';
      params.push(projectId);
    }

    const stats = db.prepare(query).get(...params);

    const statistics = {
      total: stats.total || 0,
      pass: stats.pass || 0,
      fail: stats.fail || 0,
      na: stats.na || 0,
      not_run: stats.not_run || 0,
      pass_rate: stats.pass_rate || 0
    };

    return NextResponse.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
