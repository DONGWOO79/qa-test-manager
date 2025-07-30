'use client';

import { useState, useEffect } from 'react';
import { EyeIcon, PencilIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
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
  // Parse description to extract pre-condition and test step
  const parseDescription = (description: string) => {
    const preConditionMatch = description.match(/사전 조건:\s*([\s\S]*?)(?=확인 방법:|기대 결과:|$)/);
    const testStepMatch = description.match(/확인 방법:\s*([\s\S]*?)(?=기대 결과:|$)/);
    
    return {
      preCondition: preConditionMatch ? preConditionMatch[1].trim() : "",
      testStep: testStepMatch ? testStepMatch[1].trim() : ""
    };
  };

  // Toggle row expansion
  const toggleRowExpansion = (testCaseId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(testCaseId)) {
      newExpandedRows.delete(testCaseId);
    } else {
      newExpandedRows.add(testCaseId);
    }
    setExpandedRows(newExpandedRows);
  };
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

  // Get sheet-based tabs from imported categories
  const getProjectTabs = () => {
    // 카테고리에서 시트명 추출 (예: "[인증] 로그인 > 일반" -> "인증")
    const extractSheetName = (category: string) => {
      const match = category.match(/^\[([^\]]+)\]/);
      return match ? match[1] : null;
    };

    // 모든 시트명 수집
    const sheetNames = new Set<string>();
    testCases.forEach(tc => {
      const sheetName = extractSheetName(tc.category);
      if (sheetName) {
        sheetNames.add(sheetName);
      }
    });

    // 탭 구성
    const tabs = [
      { id: 'all', name: '전체', count: testCases.length }
    ];

    // 시트별 탭 추가
    Array.from(sheetNames).sort().forEach(sheetName => {
      const count = testCases.filter(tc => 
        extractSheetName(tc.category) === sheetName
      ).length;
      tabs.push({
        id: sheetName,
        name: sheetName,
        count: count
      });
    });

    return tabs;
  };

  // Filter test cases by active tab
  const getFilteredTestCases = () => {
    if (activeTab === 'all') {
      return testCases;
    }
    
    // 시트명으로 필터링
    return testCases.filter(tc => {
      const match = tc.category.match(/^\[([^\]]+)\]/);
      const sheetName = match ? match[1] : null;
      return sheetName === activeTab;
    });
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'passed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'blocked': return 'bg-yellow-100 text-yellow-800';
      case 'skipped': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'not_run': return '미실행';
      case 'in_progress': return '진행중';
      case 'passed': return '통과';
      case 'failed': return '실패';
      case 'blocked': return '차단';
      case 'skipped': return '건너뜀';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      case 'critical': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      case 'critical': return 'Critical';
      default: return priority;
    }
  };

  // Extract classification 1 from category
  const getClassification1 = (category: string) => {
    // 카테고리에서 분류기준 1 추출 (예: "[인증] 로그인 > 일반" -> "로그인")
    const parts = category.split(']');
    if (parts.length > 1) {
      const afterBracket = parts[1].trim();
      const firstPart = afterBracket.split('>')[0];
      return firstPart.trim();
    }
    return category;
  };

  // Extract classification 2 and 3 from category
  const getClassification2And3 = (category: string) => {
    // 카테고리에서 분류기준 2, 3 추출 (예: "[인증] 로그인 > 일반 > 상세" -> "일반 > 상세")
    const parts = category.split(']');
    if (parts.length > 1) {
      const afterBracket = parts[1].trim();
      const allParts = afterBracket.split('>');
      if (allParts.length > 1) {
        // 분류기준 2와 3만 추출 (첫 번째는 분류기준 1이므로 제외)
        const classification2And3 = allParts.slice(1).map(part => part.trim()).filter(part => part);
        return classification2And3.join(' > ');
      }
    }
    return '';
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

  const projectTabs = getProjectTabs();
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

      {/* Project Tabs */}
      <div className="bg-white border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          {projectTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Test Cases Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {/* Table Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-8 gap-4">
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">타이틀</span>
            </div>
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">카테고리</span>
            </div>
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">사전 조건</span>
            </div>
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">확인 방법</span>
            </div>
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">우선순위</span>
            </div>
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">상태</span>
            </div>
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">생성일</span>
            </div>
            <div className="col-span-1">
              <span className="text-sm font-medium text-gray-500">작업</span>
            </div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredTestCases.map((testCase) => (
            <li key={testCase.id} className="px-6 py-4">
              <div className="grid grid-cols-8 gap-4">
                {/* Title */}
                <div className="col-span-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getClassification1(testCase.category)}
                  </p>
                </div>
                
                {/* Category */}
                <div className="col-span-1">
                  <span className="text-sm text-gray-500 truncate">
                    {getClassification2And3(testCase.category)}
                  </span>
                </div>
                
                {/* Pre-condition */}
                <div className="col-span-1">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => toggleRowExpansion(testCase.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {expandedRows.has(testCase.id) ? (
                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    <span className="text-sm text-gray-600 truncate">
                      {parseDescription(testCase.description).preCondition ? (
                        parseDescription(testCase.description).preCondition.length > 15 ?
                          `${parseDescription(testCase.description).preCondition.substring(0, 15)}...` :
                          parseDescription(testCase.description).preCondition
                      ) : "사전 조건 없음"}
                    </span>
                  </div>
                  {expandedRows.has(testCase.id) && parseDescription(testCase.description).preCondition && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap">
                      {parseDescription(testCase.description).preCondition}
                    </div>
                  )}
                </div>

                {/* Test Step */}
                <div className="col-span-1">
                  <span className="text-sm text-gray-600 truncate">
                    {parseDescription(testCase.description).testStep ? (
                      parseDescription(testCase.description).testStep.length > 15 ?
                        `${parseDescription(testCase.description).testStep.substring(0, 15)}...` :
                        parseDescription(testCase.description).testStep
                    ) : "확인 방법 없음"}
                  </span>
                  {expandedRows.has(testCase.id) && parseDescription(testCase.description).testStep && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap">
                      {parseDescription(testCase.description).testStep}
                    </div>
                  )}
                </div>
                
                {/* Priority */}
                <div className="col-span-1">
                  {editingField?.id === testCase.id && editingField?.field === 'priority' ? (
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
                  ) : (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(testCase.priority)} cursor-pointer hover:bg-opacity-80 justify-center`}
                      onClick={() => handleEditStart(testCase.id, "priority")}
                      title="클릭하여 편집"
                    >
                      {updatingTestCase === testCase.id ? "업데이트 중..." : getPriorityLabel(testCase.priority)}
                    </span>
                  )}
                </div>
                
                {/* Status */}
                <div className="col-span-1">
                  {editingField?.id === testCase.id && editingField?.field === 'status' ? (
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
                  ) : (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(testCase.status)} cursor-pointer hover:bg-opacity-80 justify-center`}
                      onClick={() => handleEditStart(testCase.id, "status")}
                      title="클릭하여 편집"
                    >
                      {updatingTestCase === testCase.id ? "업데이트 중..." : getStatusLabel(testCase.status)}
                    </span>
                  )}
                </div>
                
                {/* Created Date */}
                <div className="col-span-1">
                  <span className="text-sm text-gray-500">
                    {new Date(testCase.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="col-span-1">
                  <div className="flex items-center space-x-2">
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
