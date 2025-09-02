'use client';

import { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  DocumentChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface Statistics {
  total: number;
  pass: number;
  fail: number;
  na: number;
  not_run: number;
  pass_rate: number;
}

interface ReportingDashboardProps {
  projectId: string;
}

export default function ReportingDashboard({ projectId }: ReportingDashboardProps) {
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    pass: 0,
    fail: 0,
    na: 0,
    not_run: 0,
    pass_rate: 0
  });
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    fetchData();
  }, [projectId, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 프로젝트 정보 가져오기
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      const projectData = await projectResponse.json();
      if (projectData.success) {
        setProject(projectData.data);
      }

      // 통계 정보 가져오기
      const statsResponse = await fetch(`/api/statistics?projectId=${projectId}`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStatistics(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'excel') => {
    try {
      // Excel만 지원하므로 format을 무시하고 statistics로 고정
      const response = await fetch(`/api/import-export/export-excel?projectId=${projectId}&type=statistics`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 파일명 설정 (확장자 강제)
        const today = new Date().toISOString().split('T')[0];
        const filename = `qa-report-${projectId}-${today}.xlsx`;
        
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        // 정리
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
      } else {
        const error = await response.json();
        alert('내보내기 실패: ' + error.error);
      }
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

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">프로젝트 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 진행률 계산
  const progressRate = statistics.total > 0 
    ? ((statistics.pass + statistics.fail + statistics.na) / statistics.total) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QA 테스트 리포트</h1>
            <p className="text-gray-600">{project.name}</p>
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
            <p className="text-sm font-medium text-gray-600">프로젝트명</p>
            <p className="text-lg text-gray-900">{project.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">설명</p>
            <p className="text-lg text-gray-900">{project.description}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">상태</p>
            <p className="text-lg text-gray-900">{project.status}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">총 검증 개수</p>
            <p className="text-2xl font-bold text-blue-600">{statistics.total}</p>
          </div>
        </div>
      </div>

      {/* 전체 통계 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">전체 테스트 결과</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{statistics.pass}</div>
            <div className="text-sm text-gray-600">Passed</div>
            <div className="text-xs text-gray-500">({statistics.pass_rate.toFixed(1)}%)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{statistics.fail}</div>
            <div className="text-sm text-gray-600">Failed</div>
            <div className="text-xs text-gray-500">({statistics.fail > 0 ? ((statistics.fail / statistics.total) * 100).toFixed(1) : 0}%)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{statistics.na}</div>
            <div className="text-sm text-gray-600">N/A</div>
            <div className="text-xs text-gray-500">({statistics.na > 0 ? ((statistics.na / statistics.total) * 100).toFixed(1) : 0}%)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600">{statistics.not_run}</div>
            <div className="text-sm text-gray-600">Not Run</div>
            <div className="text-xs text-gray-500">({statistics.not_run > 0 ? ((statistics.not_run / statistics.total) * 100).toFixed(1) : 0}%)</div>
          </div>
        </div>

        {/* 핵심 지표 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statistics.pass_rate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Pass Rate</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{progressRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">진행률</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{statistics.total}</div>
            <div className="text-sm text-gray-600">총 테스트 케이스</div>
          </div>
        </div>
      </div>

      {/* 진행률 차트 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">테스트 진행률</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>전체 진행률</span>
              <span>{progressRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressRate}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Passed</span>
                <span>{statistics.pass_rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${statistics.pass_rate}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Failed</span>
                <span>{statistics.fail > 0 ? ((statistics.fail / statistics.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${statistics.fail > 0 ? (statistics.fail / statistics.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>N/A</span>
                <span>{statistics.na > 0 ? ((statistics.na / statistics.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${statistics.na > 0 ? (statistics.na / statistics.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Not Run</span>
                <span>{statistics.not_run > 0 ? ((statistics.not_run / statistics.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gray-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${statistics.not_run > 0 ? (statistics.not_run / statistics.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
