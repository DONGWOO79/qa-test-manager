'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, FolderIcon, UsersIcon, CalendarIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">프로젝트 목록</h2>
              <p className="text-sm text-gray-500">
                총 {projects.length}개의 프로젝트
              </p>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
              <PlusIcon className="h-4 w-4 mr-2" />
              새 프로젝트
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link 
            key={project.id} 
            href={`/projects/${project.id}`}
            className="block"
          >
            <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 cursor-pointer">
              <div className="p-6">
                {/* Project Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <FolderIcon className="h-8 w-8 text-blue-500 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {project.name}
                      </h3>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                        {getStatusLabel(project.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Project Description */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>

                {/* Project Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <UsersIcon className="h-4 w-4 mr-2" />
                    <span>{project.created_by_name}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>{new Date(project.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>

                {/* Statistics */}
                {project.statistics && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">테스트 진행률</span>
                      <span className="text-sm text-blue-600 font-semibold">
                        {project.statistics.pass_rate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${project.statistics.pass_rate}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>통과: {project.statistics.pass}</span>
                      <span>실패: {project.statistics.fail}</span>
                      <span>총계: {project.statistics.total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">프로젝트가 없습니다</h3>
          <p className="text-gray-500 mb-4">새 프로젝트를 생성하여 테스트 케이스를 관리해보세요.</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            첫 프로젝트 생성
          </button>
        </div>
      )}
    </div>
  );
}
