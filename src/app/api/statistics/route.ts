import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 프로젝트 정보 가져오기
    const project = db.prepare(`
      SELECT 
        p.*,
        tl.username as test_leader_name,
        te.username as test_engineer_name
      FROM projects p
      LEFT JOIN users tl ON p.test_leader_id = tl.id
      LEFT JOIN users te ON p.test_engineer_id = te.id
      WHERE p.id = ?
    `).get(projectId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // 전체 통계 계산
    const overallStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN tr.status = 'pass' THEN 1 ELSE 0 END) as pass,
        SUM(CASE WHEN tr.status = 'fail' THEN 1 ELSE 0 END) as fail,
        SUM(CASE WHEN tr.status = 'na' THEN 1 ELSE 0 END) as na,
        SUM(CASE WHEN tr.status = 'holding' THEN 1 ELSE 0 END) as holding
      FROM test_runs tr
      WHERE tr.project_id = ?
    `).get(projectId);

    const total = overallStats.total || 0;
    const pass = overallStats.pass || 0;
    const fail = overallStats.fail || 0;
    const na = overallStats.na || 0;
    const holding = overallStats.holding || 0;

    const passRate = total > 0 ? (pass / total) * 100 : 0;
    const coverRate = total > 0 ? ((pass + fail + na) / total) * 100 : 0;
    const progressRate = total > 0 ? ((pass + fail + na + holding) / total) * 100 : 0;
    const defectRate = total > 0 ? (fail / total) * 100 : 0;

    // 컴포넌트별 통계
    const componentStats = db.prepare(`
      SELECT 
        tc.name as component,
        COUNT(tr.id) as total,
        SUM(CASE WHEN tr.status = 'pass' THEN 1 ELSE 0 END) as pass,
        SUM(CASE WHEN tr.status = 'fail' THEN 1 ELSE 0 END) as fail,
        SUM(CASE WHEN tr.status = 'na' THEN 1 ELSE 0 END) as na,
        SUM(CASE WHEN tr.status = 'holding' THEN 1 ELSE 0 END) as holding
      FROM test_categories tc
      LEFT JOIN test_cases tcs ON tc.id = tcs.category_id
      LEFT JOIN test_runs tr ON tcs.id = tr.test_case_id AND tr.project_id = ?
      WHERE tc.project_id = ? AND tc.parent_id IS NULL
      GROUP BY tc.id, tc.name
    `).all(projectId, projectId);

    // 컴포넌트별 비율 계산
    const componentsWithRates = componentStats.map((comp: any) => {
      const compTotal = comp.total || 0;
      const compPass = comp.pass || 0;
      const compFail = comp.fail || 0;
      const compNa = comp.na || 0;
      const compHolding = comp.holding || 0;

      return {
        ...comp,
        pass_rate: compTotal > 0 ? (compPass / compTotal) * 100 : 0,
        cover_rate: compTotal > 0 ? ((compPass + compFail + compNa) / compTotal) * 100 : 0,
        defect_rate: compTotal > 0 ? (compFail / compTotal) * 100 : 0
      };
    });

    const statistics = {
      project_id: parseInt(projectId),
      project_name: project.name,
      overall: {
        total,
        pass,
        fail,
        na,
        holding,
        pass_rate: Math.round(passRate * 100) / 100,
        cover_rate: Math.round(coverRate * 100) / 100,
        progress_rate: Math.round(progressRate * 100) / 100,
        defect_rate: Math.round(defectRate * 100) / 100
      },
      components: componentsWithRates.map((comp: any) => ({
        ...comp,
        pass_rate: Math.round(comp.pass_rate * 100) / 100,
        cover_rate: Math.round(comp.cover_rate * 100) / 100,
        defect_rate: Math.round(comp.defect_rate * 100) / 100
      })),
      qa_team: {
        test_leader: project.test_leader_name,
        test_engineer: project.test_engineer_name
      },
      test_environment: {
        server: project.server,
        device: project.device
      },
      test_period: {
        start_date: project.start_date,
        end_date: project.end_date
      }
    };

    return NextResponse.json({ success: true, data: statistics });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
