'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, FolderIcon, UsersIcon, CalendarIcon, ChartBarIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import ProjectForm from './ProjectForm';

interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
  created_by_name: string;
  created_at: string;
  test_case_count?: number;
  statistics?: {
    total: number;
    pass: number;
    fail: number;
    na: number;
    not_run: number;
    pass_rate: number;
  };
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      
      if (data.success) {
        const projectsWithStats = await Promise.all(
          data.data.map(async (project: Project) => {
            try {
              const statsResponse = await fetch(`/api/statistics?projectId=${project.id}`);
              const statsData = await statsResponse.json();
              return {
                ...project,
                statistics: statsData.success ? statsData.data : null
              };
            } catch (error) {
              console.error(`Error fetching stats for project ${project.id}:`, error);
              return project;
            }
          })
        );
        setProjects(projectsWithStats);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData: { name: string; description: string; status: string }) => {
    try {
      setCreatingProject(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      const data = await response.json();
      
      if (data.success) {
        setShowProjectForm(false);
        await fetchProjects();
        alert('프로젝트가 성공적으로 생성되었습니다.');
      } else {
        alert('프로젝트 생성에 실패했습니다: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('프로젝트 생성 중 오류가 발생했습니다.');
    } finally {
      setCreatingProject(false);
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

  const getStatusText = (status: string) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">QA 테스트 관리</h1>
              <p className="text-gray-600">프로젝트별 테스트 케이스를 관리하고 결과를 추적하세요.</p>
            </div>
          </div>
        </div>

        {/* Projects Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">프로젝트 목록</h2>
              <p className="text-sm text-gray-500">
                총 {projects.length}개의 프로젝트
              </p>
            </div>
            <button 
              onClick={() => setShowProjectForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              새 프로젝트
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link 
              key={project.id} 
              href={`/projects/${project.id}`}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <FolderIcon className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                      {getStatusText(project.status)}
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {project.description || '설명이 없습니다.'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-500">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  {project.created_by_name || 'Unknown'}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {new Date(project.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>

              {project.statistics && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">테스트 케이스</span>
                    <span className="font-medium">{project.statistics.total}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">통과율</span>
                    <span className="font-medium text-green-600">
                      {project.statistics.pass_rate ? `${(project.statistics.pass_rate * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {projects.length === 0 && !loading && (
          <div className="text-center py-12">
            <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">프로젝트가 없습니다</h3>
            <p className="text-gray-500 mb-4">새 프로젝트를 생성하여 테스트 케이스를 관리해보세요.</p>
            <button 
              onClick={() => setShowProjectForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              첫 프로젝트 생성
            </button>
          </div>
        )}
      </div>

      {/* Project Form Modal */}
      <ProjectForm
        isOpen={showProjectForm}
        onClose={() => setShowProjectForm(false)}
        onSubmit={handleCreateProject}
        loading={creatingProject}
      />
    </div>
  );
}
