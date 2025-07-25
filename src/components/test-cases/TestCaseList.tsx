'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import SearchBar from '@/components/search/SearchBar';
import { SearchFilters } from '@/lib/search/filterUtils';

interface TestCase {
  id: number;
  title: string;
  description: string;
  category_name: string;
  priority: string;
  status: string;
  created_by_name: string;
  created_at: string;
  test_suite_name?: string;
  project_name?: string;
  tags?: string;
}

interface TestCaseListProps {
  projectId?: string;
}

export default function TestCaseList({ projectId }: TestCaseListProps) {
  const router = useRouter();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({
    query: '',
    status: '',
    priority: '',
    project: '',
    tags: '',
    dateFrom: '',
    dateTo: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 탭 관련 상태
  const [activeTab, setActiveTab] = useState<string>('all');
  const [availableTabs, setAvailableTabs] = useState<Array<{id: string, name: string, count: number}>>([]);

  useEffect(() => {
    fetchProjects();
    fetchTestCases();
  }, [projectId]);

  useEffect(() => {
    // 탭 정보 업데이트
    updateTabInfo();
  }, [testCases]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchTestCases = async (filters: SearchFilters = currentFilters, page: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Add search parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      // Add pagination and sorting
      params.append('page', page.toString());
      params.append('limit', '1000'); // 더 많은 데이터를 가져와서 탭별 필터링
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      
      if (projectId) {
        params.append('projectId', projectId);
      }

      const response = await fetch(`/api/test-cases/search?${params}`);
      const data = await response.json();

      if (data.testCases) {
        setTestCases(data.testCases);
        setFilteredCases(data.testCases);
        setPagination(data.pagination);
      } else if (data.success) {
        // Fallback to old API if search endpoint not available
        setTestCases(data.data || []);
        setFilteredCases(data.data || []);
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalCount: data.data?.length || 0,
          hasNextPage: false,
          hasPrevPage: false
        });
      }
    } catch (error) {
      console.error('Error fetching test cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTabInfo = () => {
    const tabs = [
      { id: 'all', name: '전체', count: testCases.length }
    ];

    // 시트별 탭 생성
    const sheetGroups = new Map<string, number>();
    testCases.forEach(testCase => {
      const sheetName = extractSheetName(testCase.category_name);
      if (sheetName) {
        sheetGroups.set(sheetName, (sheetGroups.get(sheetName) || 0) + 1);
      }
    });

    sheetGroups.forEach((count, sheetName) => {
      tabs.push({
        id: sheetName,
        name: sheetName,
        count: count
      });
    });

    setAvailableTabs(tabs);
  };

  const extractSheetName = (categoryName: string): string | null => {
    const match = categoryName.match(/^\[([^\]]+)\]/);
    return match ? match[1] : null;
  };

  const filterByActiveTab = (cases: TestCase[]) => {
    if (activeTab === 'all') {
      return cases;
    }
    return cases.filter(testCase => {
      const sheetName = extractSheetName(testCase.category_name);
      return sheetName === activeTab;
    });
  };

  const handleSearch = (filters: SearchFilters) => {
    setCurrentFilters(filters);
    fetchTestCases(filters, 1);
  };

  const handleSort = (field: string) => {
    const newSortOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newSortOrder);
    fetchTestCases(currentFilters, pagination.currentPage);
  };

  const handlePageChange = (page: number) => {
    fetchTestCases(currentFilters, page);
  };

  const handleViewTestCase = (testCaseId: number) => {
    router.push(`/test-cases/${testCaseId}`);
  };

  const handleEditTestCase = (testCaseId: number) => {
    router.push(`/test-cases/${testCaseId}`);
  };

  const handleDeleteTestCase = async (testCaseId: number) => {
    if (!confirm('정말로 이 테스트 케이스를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/test-cases/${testCaseId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        // Refresh the list
        fetchTestCases();
      } else {
        alert('테스트 케이스 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting test case:', error);
      alert('테스트 케이스 삭제에 실패했습니다.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pass':
        return 'bg-green-100 text-green-800';
      case 'fail':
        return 'bg-red-100 text-red-800';
      case 'na':
        return 'bg-gray-100 text-gray-800';
      case 'not_run':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return '높음';
      case 'medium':
        return '보통';
      case 'low':
        return '낮음';
      default:
        return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pass':
        return '통과';
      case 'fail':
        return '실패';
      case 'na':
        return '해당없음';
      case 'not_run':
        return '미실행';
      default:
        return status;
    }
  };

  // 현재 탭에 맞는 테스트케이스 필터링
  const currentTabCases = filterByActiveTab(filteredCases);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <SearchBar 
        onSearch={handleSearch} 
        projects={projects} 
        totalResults={currentTabCases.length} 
        appliedFilters={currentFilters} 
        onClearFilter={(key) => { 
          const newFilters = { ...currentFilters, [key]: "" }; 
          setCurrentFilters(newFilters); 
          fetchTestCases(newFilters, 1); 
        }} 
        onClearAllFilters={() => { 
          const clearedFilters = { 
            query: "", 
            status: "", 
            priority: "", 
            project: "", 
            tags: "", 
            dateFrom: "", 
            dateTo: "" 
          }; 
          setCurrentFilters(clearedFilters); 
          fetchTestCases(clearedFilters, 1); 
        }} 
      />

      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">테스트 케이스</h2>
              <p className="text-sm text-gray-500">
                총 {currentTabCases.length}개의 테스트 케이스
              </p>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
              <PlusIcon className="h-4 w-4 mr-2" />
              새 테스트 케이스
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Test Cases Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center">
                    제목
                    {sortBy === 'title' && (
                      <ChevronDownIcon className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  프로젝트
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  카테고리
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center">
                    우선순위
                    {sortBy === 'priority' && (
                      <ChevronDownIcon className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    상태
                    {sortBy === 'status' && (
                      <ChevronDownIcon className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  태그
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">
                    작성일
                    <ChevronDownIcon className="h-4 w-4 ml-1" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentTabCases.map((testCase) => (
                <tr key={testCase.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {testCase.title}
                    </div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {testCase.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {testCase.project_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {testCase.category_name || testCase.test_suite_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(testCase.priority)}`}>
                      {getPriorityLabel(testCase.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(testCase.status)}`}>
                      {getStatusLabel(testCase.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {testCase.tags ? (
                      <div className="flex flex-wrap gap-1">
                        {testCase.tags.split(',').map((tag, index) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(testCase.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleViewTestCase(testCase.id)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                        title="보기"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleEditTestCase(testCase.id)}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        title="수정"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTestCase(testCase.id)}
                        className="text-red-600 hover:text-red-900 flex items-center"
                        title="삭제"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {currentTabCases.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                <span>페이지 {pagination.currentPage} / {pagination.totalPages}</span>
                <span className="ml-2">(총 {pagination.totalCount}개)</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
