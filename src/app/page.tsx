'use client';

import { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  DocumentTextIcon, 
  UserGroupIcon, 
  CogIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import TestCaseList from '@/components/test-cases/TestCaseList';
import TestExecutionDashboard from '@/components/test-execution/TestExecutionDashboard';
import ReportingDashboard from '@/components/reports/ReportingDashboard';
import ExcelImportExport from '@/components/import-export/ExcelImportExport';

interface TestStatistics {
  total: number;
  pass: number;
  fail: number;
  na: number;
  holding: number;
  pass_rate: number;
  cover_rate: number;
  progress_rate: number;
  defect_rate: number;
}

interface ComponentStatistics {
  component: string;
  total: number;
  pass: number;
  fail: number;
  na: number;
  holding: number;
  pass_rate: number;
  cover_rate: number;
  defect_rate: number;
}

export default function Dashboard() {
  const [statistics, setStatistics] = useState<TestStatistics>({
    total: 459,
    pass: 362,
    fail: 0,
    na: 97,
    holding: 0,
    pass_rate: 100.0,
    cover_rate: 100.0,
    progress_rate: 100.0,
    defect_rate: 0.0
  });

  const [components, setComponents] = useState<ComponentStatistics[]>([
    {
      component: 'Q',
      total: 212,
      pass: 157,
      fail: 0,
      na: 55,
      holding: 0,
      pass_rate: 100.0,
      cover_rate: 100.0,
      defect_rate: 0.0
    },
    {
      component: 'T2',
      total: 247,
      pass: 205,
      fail: 0,
      na: 42,
      holding: 0,
      pass_rate: 100.0,
      cover_rate: 100.0,
      defect_rate: 0.0
    }
  ]);

  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projectId] = useState('1'); // 실제로는 프로젝트 선택에서 가져와야 함

  useEffect(() => {
    initializeDatabase();
  }, []);

  const initializeDatabase = async () => {
    try {
      const response = await fetch('/api/init-db', { method: 'POST' });
      if (response.ok) {
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  const StatusCard = ({ status, count, percentage, color }: any) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{status}</p>
          <p className="text-2xl font-semibold text-gray-900">{count}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <span className="text-white font-semibold">{percentage}%</span>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            {/* Project Info */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">프로젝트 정보</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">QA 담당자</p>
                    <p className="text-lg text-gray-900">Test Leader: Dorothy</p>
                    <p className="text-lg text-gray-900">Test Engineer: John</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">테스트 환경</p>
                    <p className="text-lg text-gray-900">Server: QA</p>
                    <p className="text-lg text-gray-900">Device: PC (Web / Chrome)</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">테스트 설계</p>
                    <p className="text-lg text-gray-900">Group TestENC</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">테스트 기간</p>
                    <p className="text-lg text-gray-900">2025.01.20 - 2025.01.31</p>
                    <p className="text-sm text-gray-600">(총 3일 근무)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="총 검증 개수"
                value={statistics.total}
                icon={DocumentTextIcon}
                color="bg-blue-500"
              />
              <StatCard
                title="Pass Rate"
                value={`${statistics.pass_rate}%`}
                icon={CheckCircleIcon}
                color="bg-green-500"
              />
              <StatCard
                title="Cover Rate"
                value={`${statistics.cover_rate}%`}
                icon={ChartBarIcon}
                color="bg-purple-500"
              />
              <StatCard
                title="진행률"
                value={`${statistics.progress_rate}%`}
                icon={PlayIcon}
                color="bg-orange-500"
              />
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatusCard
                status="Pass"
                count={statistics.pass}
                percentage={Math.round((statistics.pass / statistics.total) * 100)}
                color="bg-green-500"
              />
              <StatusCard
                status="Fail"
                count={statistics.fail}
                percentage={Math.round((statistics.fail / statistics.total) * 100)}
                color="bg-red-500"
              />
              <StatusCard
                status="NA"
                count={statistics.na}
                percentage={Math.round((statistics.na / statistics.total) * 100)}
                color="bg-gray-500"
              />
              <StatusCard
                status="Holding"
                count={statistics.holding}
                percentage={Math.round((statistics.holding / statistics.total) * 100)}
                color="bg-yellow-500"
              />
            </div>

            {/* Component Statistics */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">컴포넌트별 1차 QA 결과</h2>
              </div>
              <div className="p-6">
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
                      {components.map((component) => (
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
                          {statistics.total}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                          {statistics.pass}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                          {statistics.fail}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-600">
                          {statistics.na}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-yellow-600">
                          {statistics.holding}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                          {statistics.pass_rate}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                          {statistics.cover_rate}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      case 'test-cases':
        return <TestCaseList projectId={projectId} />;
      case 'test-execution':
        return <TestExecutionDashboard projectId={projectId} />;
      case 'reports':
        return <ReportingDashboard projectId={projectId} />;
      case 'import-export':
        return <ExcelImportExport projectId={projectId} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">QA 테스트 관리 시스템</h1>
              <p className="text-gray-600">테스트 케이스 관리 및 실행 결과 추적</p>
            </div>
            <div className="flex space-x-4">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                새 프로젝트
              </button>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                테스트 실행
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', name: '대시보드', icon: ChartBarIcon },
              { id: 'test-cases', name: '테스트 케이스', icon: DocumentTextIcon },
              { id: 'test-execution', name: '테스트 실행', icon: PlayIcon },
              { id: 'reports', name: '리포트', icon: ChartBarIcon },
              { id: 'import-export', name: 'Import/Export', icon: ArrowUpTrayIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Database Status */}
        {!isInitialized && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  데이터베이스 초기화 중...
                </h3>
                <p className="text-sm text-yellow-700">
                  시스템을 사용하기 위해 데이터베이스를 초기화하고 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
}
