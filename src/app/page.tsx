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
  ArrowUpTrayIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import ProjectList from '@/components/projects/ProjectList';
import Logo from '@/components/common/Logo';

interface OverallStatistics {
  totalProjects: number;
  activeProjects: number;
  totalTestCases: number;
  completedTestCases: number;
  passRate: number;
}

export default function Dashboard() {
  const [statistics, setStatistics] = useState<OverallStatistics>({
    totalProjects: 0,
    activeProjects: 0,
    totalTestCases: 0,
    completedTestCases: 0,
    passRate: 0
  });

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeDatabase();
    fetchOverallStatistics();
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

  const fetchOverallStatistics = async () => {
    try {
      const response = await fetch('/api/statistics/overall');
      const data = await response.json();
      if (data.success) {
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Error fetching overall statistics:', error);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    subtitle?: string;
  }) => (
    <div className="bg-white rounded-lg shadow p-6 lg:p-8">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Logo size="lg" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">TestHome</h1>
                <p className="text-gray-600">프로젝트별 테스트 케이스 관리 및 실행 결과 추적</p>
              </div>
            </div>
          </div>
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

        {/* Overall Statistics */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">전체 현황</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 lg:gap-6">
            <StatCard
              title="총 프로젝트"
              value={statistics.totalProjects}
              icon={DocumentTextIcon}
              color="bg-blue-500"
              subtitle="전체 프로젝트 수"
            />
            <StatCard
              title="진행중 프로젝트"
              value={statistics.activeProjects}
              icon={PlayIcon}
              color="bg-green-500"
              subtitle="활성 프로젝트"
            />
            <StatCard
              title="총 테스트 케이스"
              value={statistics.totalTestCases}
              icon={ChartBarIcon}
              color="bg-purple-500"
              subtitle="전체 테스트 케이스"
            />
            <StatCard
              title="평균 통과율"
              value={`${statistics.passRate}%`}
              icon={CheckCircleIcon}
              color="bg-orange-500"
              subtitle="전체 프로젝트 평균"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="mt-12">
          <ProjectList />
        </div>
      </div>
    </div>
  );
}
