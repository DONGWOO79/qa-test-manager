'use client';

import { useState, useEffect } from 'react';
import { EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import SearchBar from '../search/SearchBar';
import SearchResultsSummary from '../search/SearchResultsSummary';
import { SearchFilters } from '@/lib/search/filterUtils';

interface TestCase {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

interface TestCaseListProps {
  projectId: string;
}

export default function TestCaseList({ projectId }: TestCaseListProps) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [updatingTestCase, setUpdatingTestCase] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<{ id: number; field: string } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
    query: '',
    status: '',
    priority: '',
    project: '',
    tags: '',
    dateFrom: '',
    dateTo: ''
  });

  // Fetch projects
  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  // Fetch test cases
  const fetchTestCases = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/test-cases?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        // API는 data 배열을 반환하므로 이를 사용
        const testCasesData = data.data || [];
        // category_name을 category로 매핑
        const mappedTestCases = testCasesData.map((tc: any) => ({
          ...tc,
          category: tc.category_name || tc.category || ''
        }));
        console.log('Fetched test cases:', mappedTestCases.length, 'items');
        setTestCases(mappedTestCases);
      } else {
        setError('테스트케이스를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      setError('테스트케이스를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories (sheets)
  const getCategories = () => {
    const categories = [...new Set(testCases.map(tc => tc.category))];
    return categories.filter(cat => cat && cat.trim() !== '');
  };

  // Filter test cases by active tab
  const getFilteredTestCases = () => {
    if (activeTab === 'all') {
      return testCases;
    }
    return testCases.filter(tc => tc.category === activeTab);
  };



  // Handle search
  const handleSearch = async (filters: SearchFilters) => {
    try {
      setAppliedFilters(filters);
      const params = new URLSearchParams({
        projectId,
        ...filters
      });

      const response = await fetch(`/api/test-cases/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        // API는 data 배열을 반환하므로 이를 사용
        const testCasesData = data.data || [];
        // category_name을 category로 매핑
        const mappedTestCases = testCasesData.map((tc: any) => ({
          ...tc,
          category: tc.category_name || tc.category || ''
        }));
        setTestCases(mappedTestCases);
      }
    } catch (error) {
      console.error('Error searching test cases:', error);
    }
  };

  // Handle edit start
  const handleEditStart = (testCaseId: number, field: string) => {
    setEditingField({ id: testCaseId, field });
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditingField(null);
  };

  // Handle keyboard events for editing
  const handleKeyDown = (e: React.KeyboardEvent, testCaseId: number, field: string, currentValue: string) => {
    if (e.key === 'Escape') {
      handleEditCancel();
    } else if (e.key === 'Enter') {
      if (field === 'priority') {
        handlePriorityChange(testCaseId, currentValue);
      } else if (field === 'status') {
        handleStatusChange(testCaseId, currentValue);
      }
    }
  };

  // Handle status change
  const handleStatusChange = async (testCaseId: number, newStatus: string) => {
    setUpdatingTestCase(testCaseId);
    
    try {
      const response = await fetch(`/api/test-cases/${testCaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Success - refresh the list
        fetchTestCases();
        setEditingField(null);
        alert('상태가 성공적으로 업데이트되었습니다.');
      } else {
        alert('상태 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('상태 업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdatingTestCase(null);
    }
  };

  // Handle priority change
  const handlePriorityChange = async (testCaseId: number, newPriority: string) => {
    setUpdatingTestCase(testCaseId);
    
    try {
      const response = await fetch(`/api/test-cases/${testCaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (response.ok) {
        // Success - refresh the list
        fetchTestCases();
        setEditingField(null);
        alert('우선순위가 성공적으로 업데이트되었습니다.');
      } else {
        alert('우선순위 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('우선순위 업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdatingTestCase(null);
    }
  };

  // Utility functions
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pass': return 'bg-green-100 text-green-800';
      case 'fail': return 'bg-red-100 text-red-800';
      case 'na': return 'bg-gray-100 text-gray-800';
      case 'holding': return 'bg-yellow-100 text-yellow-800';
      case 'not_run': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pass': return 'Pass';
      case 'fail': return 'Fail';
      case 'na': return 'NA';
      case 'holding': return 'Holding';
      case 'not_run': return 'Not Run';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return priority;
    }
  };

  // Load test cases on component mount
  useEffect(() => {
    fetchProjects();
    fetchTestCases();
  }, [projectId]);



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">테스트케이스를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  const categories = getCategories();
  const filteredTestCases = getFilteredTestCases();

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <SearchBar 
        onSearch={handleSearch}
        projects={projects}
        totalResults={filteredTestCases.length}
        appliedFilters={appliedFilters}
        onClearFilter={(key) => {
          const newFilters = { ...appliedFilters, [key]: '' };
          setAppliedFilters(newFilters);
          handleSearch(newFilters);
        }}
        onClearAllFilters={() => {
          const clearedFilters = {
            query: '',
            status: '',
            priority: '',
            project: '',
            tags: '',
            dateFrom: '',
            dateTo: ''
          };
          setAppliedFilters(clearedFilters);
          fetchTestCases();
        }}
      />

      {/* Search Results Summary */}
      <SearchResultsSummary
        totalResults={filteredTestCases.length}
        appliedFilters={appliedFilters}
        onClearFilter={(key) => {
          const newFilters = { ...appliedFilters, [key]: '' };
          setAppliedFilters(newFilters);
          handleSearch(newFilters);
        }}
        onClearAllFilters={() => {
          const clearedFilters = {
            query: '',
            status: '',
            priority: '',
            project: '',
            tags: '',
            dateFrom: '',
            dateTo: ''
          };
          setAppliedFilters(clearedFilters);
          fetchTestCases();
        }}
      />

      {/* Category Filter */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">카테고리 필터:</span>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 ({testCases.length})</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category} ({testCases.filter(tc => tc.category === category).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Test Cases Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {/* Table Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900">테스트케이스 목록</h3>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-500 w-24">카테고리</span>
              <span className="text-sm font-medium text-gray-500 w-20">우선순위</span>
              <span className="text-sm font-medium text-gray-500 w-16">상태</span>
              <span className="text-sm font-medium text-gray-500 w-24">생성일</span>
              <span className="text-sm font-medium text-gray-500 w-16">작업</span>
            </div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredTestCases.map((testCase) => (
            <li key={testCase.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {testCase.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {testCase.description}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Category */}
                  <span className="text-sm text-gray-500 w-24 truncate">
                    {testCase.category}
                  </span>
                  
                  {/* Priority */}
                  {editingField?.id === testCase.id && editingField?.field === 'priority' ? (
                    <div className="w-20">
                      <select
                        value={testCase.priority}
                        onChange={(e) => handlePriorityChange(testCase.id, e.target.value)}
                        onBlur={handleEditCancel}
                        onKeyDown={(e) => handleKeyDown(e, testCase.id, 'priority', testCase.priority)}
                        className="w-full text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      >
                        <option value="low">낮음</option>
                        <option value="medium">보통</option>
                        <option value="high">높음</option>
                        <option value="critical">긴급</option>
                      </select>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(testCase.priority)} cursor-pointer hover:bg-opacity-80 w-20 justify-center`}
                      onClick={() => handleEditStart(testCase.id, "priority")}
                      title="클릭하여 편집"
                    >
                      {updatingTestCase === testCase.id ? "업데이트 중..." : getPriorityLabel(testCase.priority)}
                    </span>
                  )}
                  
                  {/* Status */}
                  {editingField?.id === testCase.id && editingField?.field === 'status' ? (
                    <div className="w-16">
                      <select
                        value={testCase.status}
                        onChange={(e) => handleStatusChange(testCase.id, e.target.value)}
                        onBlur={handleEditCancel}
                        onKeyDown={(e) => handleKeyDown(e, testCase.id, 'status', testCase.status)}
                        className="w-full text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      >
                        <option value="not_run">미실행</option>
                        <option value="in_progress">진행중</option>
                        <option value="passed">통과</option>
                        <option value="failed">실패</option>
                        <option value="blocked">차단</option>
                        <option value="skipped">건너뜀</option>
                      </select>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(testCase.status)} cursor-pointer hover:bg-opacity-80 w-16 justify-center`}
                      onClick={() => handleEditStart(testCase.id, "status")}
                      title="클릭하여 편집"
                    >
                      {updatingTestCase === testCase.id ? "업데이트 중..." : getStatusLabel(testCase.status)}
                    </span>
                  )}
                  
                  {/* Created Date */}
                  <span className="text-sm text-gray-500 w-24">
                    {new Date(testCase.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  
                  {/* Actions */}
                  <div className="flex items-center space-x-2 w-16">
                    <Link
                      href={`/test-cases/${testCase.id}`}
                      className="text-blue-600 hover:text-blue-900"
                      title="보기"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/test-cases/${testCase.id}?edit=true`}
                      className="text-green-600 hover:text-green-900"
                      title="수정"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
