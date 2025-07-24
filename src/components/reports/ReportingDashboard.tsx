'use client';

import { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  DocumentChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface ReportData {
  project_id: number;
  project_name: string;
  overall: {
    total: number;
    pass: number;
    fail: number;
    na: number;
    holding: number;
    pass_rate: number;
    cover_rate: number;
    progress_rate: number;
    defect_rate: number;
  };
  components: Array<{
    component: string;
    total: number;
    pass: number;
    fail: number;
    na: number;
    holding: number;
    pass_rate: number;
    cover_rate: number;
    defect_rate: number;
  }>;
  qa_team: {
    test_leader: string;
    test_engineer: string;
  };
  test_environment: {
    server: string;
    device: string;
  };
  test_period: {
    start_date: string;
    end_date: string;
  };
}

interface ReportingDashboardProps {
  projectId: string;
}

export default function ReportingDashboard({ projectId }: ReportingDashboardProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    fetchReportData();
  }, [projectId, dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/statistics?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setReportData(data.data);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'excel') => {
    try {
      const response = await fetch(`/api/reports/export?projectId=${projectId}&format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qa-report-${projectId}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('리포트 내보내기에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">리포트 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QA 테스트 리포트</h1>
            <p className="text-gray-600">{reportData.project_name}</p>
          </div>
          <div className="flex space-x-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 기간</option>
              <option value="week">최근 1주</option>
              <option value="month">최근 1개월</option>
              <option value="quarter">최근 3개월</option>
            </select>
            <button
              onClick={() => exportReport('excel')}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Excel 내보내기
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              PDF 내보내기
            </button>
          </div>
        </div>
      </div>

      {/* 프로젝트 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">프로젝트 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600">QA 담당자</p>
            <p className="text-lg text-gray-900">Test Leader: {reportData.qa_team.test_leader}</p>
            <p className="text-lg text-gray-900">Test Engineer: {reportData.qa_team.test_engineer}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">테스트 환경</p>
            <p className="text-lg text-gray-900">Server: {reportData.test_environment.server}</p>
            <p className="text-lg text-gray-900">Device: {reportData.test_environment.device}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">테스트 기간</p>
            <p className="text-lg text-gray-900">
              {new Date(reportData.test_period.start_date).toLocaleDateString('ko-KR')} - 
              {new Date(reportData.test_period.end_date).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">총 검증 개수</p>
            <p className="text-2xl font-bold text-blue-600">{reportData.overall.total}</p>
          </div>
        </div>
      </div>

      {/* 전체 통계 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">전체 테스트 결과</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{reportData.overall.pass}</div>
            <div className="text-sm text-gray-600">통과</div>
            <div className="text-xs text-gray-500">({reportData.overall.pass_rate.toFixed(1)}%)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{reportData.overall.fail}</div>
            <div className="text-sm text-gray-600">실패</div>
            <div className="text-xs text-gray-500">({reportData.overall.defect_rate.toFixed(1)}%)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{reportData.overall.na}</div>
            <div className="text-sm text-gray-600">해당없음</div>
            <div className="text-xs text-gray-500">({((reportData.overall.na / reportData.overall.total) * 100).toFixed(1)}%)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600">{reportData.overall.holding}</div>
            <div className="text-sm text-gray-600">보류</div>
            <div className="text-xs text-gray-500">({((reportData.overall.holding / reportData.overall.total) * 100).toFixed(1)}%)</div>
          </div>
        </div>

        {/* 핵심 지표 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{reportData.overall.pass_rate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Pass Rate</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{reportData.overall.cover_rate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Cover Rate</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{reportData.overall.progress_rate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">진행률</div>
          </div>
        </div>
      </div>

      {/* 컴포넌트별 통계 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">컴포넌트별 테스트 결과</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Component
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pass
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Holding
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pass Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cover Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.components.map((component) => (
                <tr key={component.component}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {component.component}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {component.total}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    {component.pass}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {component.fail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {component.na}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                    {component.holding}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    {component.pass_rate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {component.cover_rate}%
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  전체
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {reportData.overall.total}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                  {reportData.overall.pass}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                  {reportData.overall.fail}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-600">
                  {reportData.overall.na}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-yellow-600">
                  {reportData.overall.holding}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                  {reportData.overall.pass_rate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                  {reportData.overall.cover_rate}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
