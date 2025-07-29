'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChartBarIcon, 
  DocumentTextIcon, 
  PlayIcon,
  ArrowUpTrayIcon,
  ArrowLeftIcon,
  TrashIcon,
  FolderIcon
} from '@heroicons/react/24/outline';
import TestCaseList from '@/components/test-cases/TestCaseList';
import TestExecutionDashboard from '@/components/test-execution/TestExecutionDashboard';
import ReportingDashboard from '@/components/reports/ReportingDashboard';
import ExcelImportExport from '@/components/import-export/ExcelImportExport';
import Logo from '@/components/common/Logo';

interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
  created_by_name: string;
  created_at: string;
}

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('test-cases');

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      
      if (data.success) {
        setProject(data.data);
      } else {
        console.error('Project not found');
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '진행중';
      case 'completed':
        return '완료';
      case 'on-hold':
        return '보류';
      case 'cancelled':
        return '취소';
      default:
        return status;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">프로젝트를 찾을 수 없습니다</h3>
        <button 
          onClick={() => router.push('/')}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          프로젝트 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button 
                onClick={() => router.push('/')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-4">
                <Logo size="md" />
                <div className="flex items-center">
                  <FolderIcon className="h-8 w-8 text-blue-500 mr-3" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                    <p className="text-gray-600">{project.description}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(project.status)}`}>
                {getStatusLabel(project.status)}
              </span>
              <button onClick={() => { if (confirm("이 프로젝트를 삭제하시겠습니까?")) { fetch(`/api/projects/${projectId}`, { method: "DELETE" }).then(res => res.json()).then(data => { if (data.success) { alert("프로젝트가 삭제되었습니다."); router.push("/"); } else { alert("삭제 실패: " + data.error); } }).catch(err => { console.error(err); alert("삭제 중 오류가 발생했습니다."); }); } }} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                프로젝트 삭제
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
        {renderContent()}
      </div>
    </div>
  );
}
