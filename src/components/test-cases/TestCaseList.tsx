'use client';

import { useState, useEffect, useCallback } from 'react';
import { EyeIcon, PencilIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import SearchBar from '../search/SearchBar';
import SearchResultsSummary from '../search/SearchResultsSummary';
import { SearchFilters } from '@/lib/search/filterUtils';

interface TestCase {
  id: number;
  title: string;
  description: string;
  test_strategy?: string;
  category: string;
  category_name?: string;
  priority: string;
  status: string;
  created_at: string;
  page_numbers?: string;
  expected_result?: string;
  preconditions?: string;
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

  // Column widths (percentage-based for responsive design)
  // 컬럼 순서: 체크박스, 페이지번호, 설명, 사전조건, 확인방법, 기대결과, 우선순위, 상태, 생성일, 작업
  // 카테고리 컬럼 제거, 사전조건 컬럼 추가
  const [columnWidths, setColumnWidths] = useState<number[]>([4, 6, 20, 16, 18, 18, 7, 7, 8, 6]);
  const [isResizing, setIsResizing] = useState<number | null>(null);
  const [startX, setStartX] = useState<number>(0);
  const [startWidth, setStartWidth] = useState<number>(0);

  // Selection and editing states
  const [selectedTestCases, setSelectedTestCases] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingData, setEditingData] = useState<Record<number, Partial<TestCase> & { preCondition?: string; testStep?: string }>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);



  // Fetch projects
  // Parse description to extract pre-condition and test step
  const parseDescription = (description: string) => {
    // AI가 생성한 다양한 형식을 모두 지원하도록 개선
    const preConditionMatch = description.match(/(?:사전 조건|사전조건|Pre-?condition|전제 조건):\s*([\s\S]*?)(?=\n\n|테스트 단계|확인 방법|예상 결과|기대 결과|$)/i);
    const testStepMatch = description.match(/(?:테스트 단계|확인 방법|Test Step|시나리오 단계):\s*([\s\S]*?)(?=\n\n|예상 결과|기대 결과|$)/i);

    // description에서 기본 설명 부분 추출 (첫 번째 줄 또는 첫 번째 섹션)
    const basicDescMatch = description.match(/^([^\n]+)/);
    const basicDescription = basicDescMatch ? basicDescMatch[1].trim() : "";

    return {
      preCondition: preConditionMatch ? preConditionMatch[1].trim() : basicDescription,
      testStep: testStepMatch ? testStepMatch[1].trim() : "확인 방법이 명시되지 않음"
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
      case 'pass': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'fail': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'blocked': return 'bg-yellow-100 text-yellow-800';
      case 'na': return 'bg-gray-100 text-gray-800';
      case 'skipped': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'not_run': return 'Not Run';
      case 'in_progress': return 'In Progress';
      case 'passed': return 'Passed';
      case 'pass': return 'Passed';
      case 'failed': return 'Failed';
      case 'fail': return 'Failed';
      case 'blocked': return 'Blocked';
      case 'na': return 'N/A';
      case 'skipped': return 'Skipped';
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

  // Extract pure description (첫 번째 부분만, 사전조건/확인방법/기대결과 제외)
  const getPureDescription = (description: string) => {
    if (!description) return '';

    // "사전 조건:", "확인 방법:", "기대 결과:" 이전까지만 추출
    const lines = description.split('\n');
    const pureLines = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('사전 조건:') ||
        trimmedLine.startsWith('확인 방법:') ||
        trimmedLine.startsWith('기대 결과:')) {
        break;
      }
      pureLines.push(line);
    }

    return pureLines.join('\n').trim();
  };

  // Resize handlers for pre-condition and test step columns only
  const handleResizeStart = useCallback((e: React.MouseEvent, columnIndex: number) => {
    // Only allow resizing for description (index 3), test step (index 4), and expected result (index 5) columns
    if (columnIndex !== 3 && columnIndex !== 4 && columnIndex !== 5) return;

    e.preventDefault();
    e.stopPropagation();
    setIsResizing(columnIndex);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnIndex]);
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing !== null && (isResizing === 3 || isResizing === 4 || isResizing === 5)) {
      const deltaX = e.clientX - startX;

      // Get table width for percentage calculation
      const tableElement = document.querySelector('.test-cases-table');
      const tableWidth = tableElement?.clientWidth || 1000;

      // Calculate percentage change
      const percentageChange = (deltaX / tableWidth) * 100;

      // Define minimum percentages for resizable columns
      const minPercentages = [4, 12, 4, 12, 12, 12, 7, 7, 8, 6];

      // Calculate new percentage with constraints
      const newPercentage = Math.max(minPercentages[isResizing], startWidth + percentageChange);

      setColumnWidths(prev => {
        const newWidths = [...prev];
        newWidths[isResizing] = newPercentage;
        return newWidths;
      });
    }
  }, [isResizing, startX, startWidth]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(null);
  }, []);

  // Add and remove event listeners for resize
  useEffect(() => {
    if (isResizing !== null) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Checkbox handlers
  const handleSelectAll = () => {
    if (selectedTestCases.size === filteredTestCases.length) {
      setSelectedTestCases(new Set());
    } else {
      setSelectedTestCases(new Set(filteredTestCases.map(tc => tc.id)));
    }
  };

  const handleSelectTestCase = (testCaseId: number) => {
    const newSelected = new Set(selectedTestCases);
    if (newSelected.has(testCaseId)) {
      newSelected.delete(testCaseId);
    } else {
      newSelected.add(testCaseId);
    }
    setSelectedTestCases(newSelected);
  };

  const handleEditField = (testCaseId: number, field: string, value: string) => {
    console.log('handleEditField called:', { testCaseId, field, value });
    setEditingData(prev => {
      const newData = {
        ...prev,
        [testCaseId]: {
          ...prev[testCaseId],
          [field]: value
        }
      };
      console.log('New editing data:', newData);
      return newData;
    });
  };

  // Helper function to reconstruct description
  const reconstructDescription = (originalDescription: string, preCondition?: string, testStep?: string) => {
    const parts = originalDescription.split(/사전 조건:|확인 방법:|기대 결과:/);
    const beforePreCondition = parts[0] || '';
    const afterTestStep = parts[3] || '';

    let newDescription = beforePreCondition;
    if (preCondition !== undefined) {
      newDescription += `사전 조건: ${preCondition}`;
    } else {
      newDescription += parts[1] ? `사전 조건: ${parts[1]}` : '';
    }

    if (testStep !== undefined) {
      newDescription += `확인 방법: ${testStep}`;
    } else {
      newDescription += parts[2] ? `확인 방법: ${parts[2]}` : '';
    }

    newDescription += afterTestStep;
    return newDescription;
  };

  const handleSaveAll = async () => {
    if (Object.keys(editingData).length === 0) return;

    setIsSaving(true);
    try {
      const updatePromises = Object.entries(editingData).map(([testCaseId, data]) => {
        const testCase = testCases.find(tc => tc.id === parseInt(testCaseId));
        if (!testCase) return Promise.resolve();

        // Reconstruct description if preCondition or testStep was edited
        let finalData = { ...data };
        if (data.preCondition !== undefined || data.testStep !== undefined) {
          finalData.description = reconstructDescription(
            testCase.description,
            data.preCondition,
            data.testStep
          );
          delete finalData.preCondition;
          delete finalData.testStep;
        }

        return fetch(`/api/test-cases/${testCaseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalData)
        });
      });

      await Promise.all(updatePromises);
      setEditingData({});
      setIsEditing(false);
      setSelectedTestCases(new Set());
      fetchTestCases(); // Refresh data
      alert('모든 변경사항이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving test cases:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
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

  const projectTabs = getProjectTabs();
  const filteredTestCases = getFilteredTestCases();

  return (
    <div className="space-y-6 w-full">
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

      {/* Project Tabs and Action Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex justify-between items-center px-6">
          <nav className="-mb-px flex space-x-8">
            {projectTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.name} ({tab.count})
              </button>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            {selectedTestCases.size > 0 && (
              <div className="text-sm text-gray-600">
                {selectedTestCases.size}개 선택됨
              </div>
            )}
            {selectedTestCases.size > 0 && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 text-sm font-medium rounded-md ${isEditing
                  ? 'bg-gray-500 text-white hover:bg-gray-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                {isEditing ? '편집 취소' : '편집 모드'}
              </button>
            )}
            {Object.keys(editingData).length > 0 && (
              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '저장 중...' : '모두 저장'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Test Cases Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md w-full test-cases-table">


        {/* Table Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex border-r border-gray-300">
            <div style={{ width: `${columnWidths[0]}%` }} className="text-center px-2 border-r border-gray-300">
              <input
                type="checkbox"
                checked={selectedTestCases.size === filteredTestCases.length && filteredTestCases.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div style={{ width: `${columnWidths[1]}%` }} className="text-center px-2 border-r border-gray-300">
              <span className="text-sm font-medium text-gray-500">페이지</span>
            </div>
            <div
              style={{ width: `${columnWidths[2]}%` }}
              className={`text-center px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                }`}
              onMouseDown={!isEditing ? (e) => handleResizeStart(e, 2) : undefined}
            >
              <span className="text-sm font-medium text-gray-500">설명</span>
            </div>
            <div
              style={{ width: `${columnWidths[3]}%` }}
              className={`text-center px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                }`}
              onMouseDown={!isEditing ? (e) => handleResizeStart(e, 3) : undefined}
            >
              <span className="text-sm font-medium text-gray-500">사전조건</span>
            </div>
            <div
              style={{ width: `${columnWidths[4]}%` }}
              className={`text-center px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                }`}
              onMouseDown={!isEditing ? (e) => handleResizeStart(e, 4) : undefined}
            >
              <span className="text-sm font-medium text-gray-500">확인 방법</span>
            </div>
            <div
              style={{ width: `${columnWidths[5]}%` }}
              className={`text-center px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                }`}
              onMouseDown={!isEditing ? (e) => handleResizeStart(e, 5) : undefined}
            >
              <span className="text-sm font-medium text-gray-500">기대 결과</span>
            </div>
            <div style={{ width: `${columnWidths[6]}%` }} className="text-center px-2 border-r border-gray-300">
              <span className="text-sm font-medium text-gray-500">우선순위</span>
            </div>
            <div style={{ width: `${columnWidths[7]}%` }} className="text-center px-2 border-r border-gray-300">
              <span className="text-sm font-medium text-gray-500">상태</span>
            </div>
            <div style={{ width: `${columnWidths[8]}%` }} className="text-center px-2 border-r border-gray-300">
              <span className="text-sm font-medium text-gray-500">생성일</span>
            </div>
            <div style={{ width: `${columnWidths[9]}%` }} className="text-center px-2">
              <span className="text-sm font-medium text-gray-500">작업</span>
            </div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredTestCases.map((testCase) => (
            <li key={testCase.id} className="px-6 py-4">
              <div className="flex border-r border-gray-300">
                {/* Checkbox */}
                <div style={{ width: `${columnWidths[0]}%` }} className="flex justify-center items-center px-2 border-r border-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedTestCases.has(testCase.id)}
                    onChange={() => handleSelectTestCase(testCase.id)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                {/* Page Numbers */}
                <div style={{ width: `${columnWidths[1]}%` }} className="flex justify-center items-center px-2 border-r border-gray-300">
                  <span className="text-xs text-gray-500">
                    {testCase.page_numbers || '-'}
                  </span>
                </div>

                {/* Description */}
                <div
                  style={{ width: `${columnWidths[2]}%` }}
                  className={`flex px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                    }`}
                  onMouseDown={!isEditing ? (e) => handleResizeStart(e, 2) : undefined}
                >
                  {/* Content area */}
                  <div className="flex flex-1">
                    {!isEditing && (
                      <button
                        onClick={() => toggleRowExpansion(testCase.id)}
                        className="p-1 hover:bg-gray-100 rounded flex-shrink-0 mt-1"
                      >
                        {expandedRows.has(testCase.id) ? (
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    )}
                    <div className={isEditing && selectedTestCases.has(testCase.id) ? "flex-1" : "flex-1 ml-2"}>
                      {(() => {
                        const pureDescription = getPureDescription(testCase.description || '');

                        if (isEditing && selectedTestCases.has(testCase.id)) {
                          return (
                            <textarea
                              defaultValue={pureDescription}
                              onChange={(e) => handleEditField(testCase.id, 'description', e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                              rows={3}
                              placeholder="설명을 입력하세요..."
                            />
                          );
                        } else if (!expandedRows.has(testCase.id)) {
                          return (
                            <span
                              className="text-sm text-gray-600 leading-relaxed"
                              style={{
                                lineHeight: columnWidths[3] > 25 ? '1.6' : columnWidths[3] > 20 ? '1.4' : '1.2',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word'
                              }}
                            >
                              {pureDescription ? (
                                pureDescription.length > 20 ?
                                  `${pureDescription.substring(0, 20)}...` :
                                  pureDescription
                              ) : "설명 없음"}
                            </span>
                          );
                        } else if (pureDescription) {
                          return (
                            <div
                              className="text-sm text-gray-600 leading-relaxed"
                              style={{
                                wordBreak: 'keep-all',
                                overflowWrap: 'break-word',
                                whiteSpace: 'pre-line'
                              }}
                            >
                              {pureDescription}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Preconditions */}
                <div
                  style={{ width: `${columnWidths[3]}%` }}
                  className={`flex px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                    }`}
                  onMouseDown={!isEditing ? (e) => handleResizeStart(e, 3) : undefined}
                >
                  {/* Content area */}
                  <div className="flex flex-1">
                    {!isEditing && (
                      <button
                        onClick={() => toggleRowExpansion(testCase.id)}
                        className="p-1 hover:bg-gray-100 rounded flex-shrink-0 mt-1"
                      >
                        {expandedRows.has(testCase.id) ? (
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    )}
                    <div className={isEditing && selectedTestCases.has(testCase.id) ? "flex-1" : "flex-1 ml-2"}>
                      {(() => {
                        // preconditions 필드를 우선 사용, 없으면 description에서 파싱
                        const preconditions = (testCase as any).preconditions || parseDescription(testCase.description).preCondition || '';

                        if (isEditing && selectedTestCases.has(testCase.id)) {
                          return (
                            <textarea
                              defaultValue={preconditions}
                              onChange={(e) => handleEditField(testCase.id, 'preCondition', e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 resize-none"
                              rows={3}
                              placeholder="사전조건을 입력하세요..."
                            />
                          );
                        } else if (!expandedRows.has(testCase.id)) {
                          return (
                            <span
                              className="text-sm text-gray-600 leading-relaxed"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: '1.4'
                              }}
                            >
                              {preconditions}
                            </span>
                          );
                        } else {
                          return (
                            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                              {preconditions}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Test Step */}
                <div
                  style={{ width: `${columnWidths[4]}%` }}
                  className={`flex px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                    }`}
                  onMouseDown={!isEditing ? (e) => handleResizeStart(e, 4) : undefined}
                >
                  {/* Content area */}
                  <div className="flex flex-1">
                    {!isEditing && (
                      <button
                        onClick={() => toggleRowExpansion(testCase.id)}
                        className="p-1 hover:bg-gray-100 rounded flex-shrink-0 mt-1"
                      >
                        {expandedRows.has(testCase.id) ? (
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    )}
                    <div className={isEditing && selectedTestCases.has(testCase.id) ? "flex-1" : "flex-1 ml-2"}>
                      {(() => {
                        // test_strategy 필드를 우선 사용, 없으면 description에서 파싱
                        const testSteps = testCase.test_strategy || parseDescription(testCase.description).testStep || '';

                        if (isEditing && selectedTestCases.has(testCase.id)) {
                          return (
                            <textarea
                              defaultValue={testSteps}
                              onChange={(e) => handleEditField(testCase.id, 'testStep', e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 resize-none"
                              rows={3}
                              placeholder="확인 방법을 입력하세요..."
                            />
                          );
                        } else if (!expandedRows.has(testCase.id)) {
                          return (
                            <span
                              className="text-sm text-gray-600 leading-relaxed"
                              style={{
                                lineHeight: columnWidths[4] > 25 ? '1.6' : columnWidths[4] > 20 ? '1.4' : '1.2',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word'
                              }}
                            >
                              {testSteps ? (
                                testSteps.length > 20 ?
                                  `${testSteps.substring(0, 20)}...` :
                                  testSteps
                              ) : "확인 방법 없음"}
                            </span>
                          );
                        } else if (testSteps) {
                          return (
                            <div
                              className="text-sm text-gray-600 leading-relaxed"
                              style={{
                                wordBreak: 'keep-all',
                                overflowWrap: 'break-word',
                                whiteSpace: 'pre-line'
                              }}
                            >
                              {testSteps}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Expected Result */}
                <div
                  style={{ width: `${columnWidths[5]}%` }}
                  className={`flex px-2 border-r border-gray-300 ${!isEditing ? 'cursor-col-resize hover:border-blue-500 transition-colors' : ''
                    }`}
                  onMouseDown={!isEditing ? (e) => handleResizeStart(e, 5) : undefined}
                >
                  <div className="flex flex-1">
                    {!isEditing && (
                      <button
                        onClick={() => toggleRowExpansion(testCase.id)}
                        className="p-1 hover:bg-gray-100 rounded flex-shrink-0 mt-1"
                      >
                        {expandedRows.has(testCase.id) ? (
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    )}
                    <div className={isEditing && selectedTestCases.has(testCase.id) ? "flex-1" : "flex-1 ml-2"}>
                      {isEditing && selectedTestCases.has(testCase.id) ? (
                        <textarea
                          defaultValue={testCase.expected_result || parseDescription(testCase.description).expectedResult || ''}
                          onChange={(e) => handleEditField(testCase.id, 'expectedResult', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                          rows={3}
                          placeholder="기대 결과를 입력하세요..."
                        />
                      ) : !expandedRows.has(testCase.id) ? (
                        <span
                          className="text-sm text-gray-600 leading-relaxed"
                          style={{
                            lineHeight: columnWidths[5] > 25 ? '1.6' : columnWidths[5] > 20 ? '1.4' : '1.2',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        >
                          {(testCase.expected_result || parseDescription(testCase.description).expectedResult) ? (
                            (testCase.expected_result || parseDescription(testCase.description).expectedResult).length > 20 ?
                              `${(testCase.expected_result || parseDescription(testCase.description).expectedResult).substring(0, 20)}...` :
                              (testCase.expected_result || parseDescription(testCase.description).expectedResult)
                          ) : "기대 결과 없음"}
                        </span>
                      ) : (testCase.expected_result || parseDescription(testCase.description).expectedResult) && (
                        <div
                          className="text-sm text-gray-600 leading-relaxed"
                          style={{
                            wordBreak: 'keep-all',
                            overflowWrap: 'break-word',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {testCase.expected_result || parseDescription(testCase.description).expectedResult}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div style={{ width: `${columnWidths[6]}%` }} className="flex justify-center items-center px-2 border-r border-gray-300">
                  {isEditing && selectedTestCases.has(testCase.id) ? (
                    <select
                      value={editingData[testCase.id]?.priority || testCase.priority}
                      onChange={(e) => handleEditField(testCase.id, 'priority', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  ) : editingField?.id === testCase.id && editingField?.field === 'priority' ? (
                    <select
                      value={testCase.priority}
                      onChange={(e) => handlePriorityChange(testCase.id, e.target.value)}
                      onBlur={handleEditCancel}
                      onKeyDown={(e) => handleKeyDown(e, testCase.id, 'priority', testCase.priority)}
                      className="w-full text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
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
                <div style={{ width: `${columnWidths[7]}%` }} className="flex justify-center items-center px-2 border-r border-gray-300">
                  {isEditing && selectedTestCases.has(testCase.id) ? (
                    <select
                      value={editingData[testCase.id]?.status || testCase.status}
                      onChange={(e) => handleEditField(testCase.id, 'status', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="not_run">Not Run</option>
                      <option value="in_progress">In Progress</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="blocked">Blocked</option>
                      <option value="na">N/A</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  ) : editingField?.id === testCase.id && editingField?.field === 'status' ? (
                    <select
                      value={testCase.status}
                      onChange={(e) => handleStatusChange(testCase.id, e.target.value)}
                      onBlur={handleEditCancel}
                      onKeyDown={(e) => handleKeyDown(e, testCase.id, 'status', testCase.status)}
                      className="w-full text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    >
                      <option value="not_run">Not Run</option>
                      <option value="in_progress">In Progress</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="blocked">Blocked</option>
                      <option value="na">N/A</option>
                      <option value="skipped">Skipped</option>
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
                <div style={{ width: `${columnWidths[8]}%` }} className="flex justify-center items-center px-2 border-r border-gray-300">
                  <span className="text-sm text-gray-500">
                    {new Date(testCase.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ width: `${columnWidths[9]}%` }} className="flex justify-center items-center px-2">
                  <div className="flex items-center justify-center space-x-2">
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
