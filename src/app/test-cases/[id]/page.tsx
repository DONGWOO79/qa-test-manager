'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  DocumentTextIcon,
  TagIcon,
  UserIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import Logo from '@/components/common/Logo';

interface TestCase {
  id: number;
  title: string;
  description: string;
  category_name: string;
  priority: string;
  status: string;
  expected_result: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  test_steps?: Array<{
    id: number;
    step_number: number;
    action: string;
    expected_result: string;
  }>;
}

export default function TestCaseDetail() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const testCaseId = params.id as string;
  
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TestCase>>({});

  useEffect(() => {
    if (testCaseId) {
      fetchTestCase();
      // URL 파라미터에서 edit 모드 확인
      const editMode = searchParams.get('edit');
      if (editMode === 'true') {
        setIsEditing(true);
      }
    }
  }, [testCaseId, searchParams]);

  const fetchTestCase = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/test-cases/${testCaseId}`);
      const data = await response.json();
      
      if (data.success) {
        setTestCase(data.data);
        setEditForm(data.data);
      } else {
        console.error('TestCase not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching test case:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/test-cases/${testCaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      if (data.success) {
        setTestCase(data.data);
        setIsEditing(false);
      } else {
        alert('테스트 케이스 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating test case:', error);
      alert('테스트 케이스 업데이트에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    setEditForm(testCase || {});
    setIsEditing(false);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!testCase) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">테스트 케이스를 찾을 수 없습니다</h3>
        <button 
          onClick={() => router.back()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          뒤로 가기
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
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-4">
                <Logo size="md" />
                <div className="flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-blue-500 mr-3" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                          className="border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        testCase.title
                      )}
                    </h1>
                    <p className="text-gray-600">테스트 케이스 상세 정보</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    저장
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    취소
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  수정
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">설명</h2>
              {isEditing ? (
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">{testCase.description}</pre>
                </div>
              )}
            </div>

            {/* Expected Result */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">기대 결과</h2>
              {isEditing ? (
                <textarea
                  value={editForm.expected_result || ''}
                  onChange={(e) => setEditForm({...editForm, expected_result: e.target.value})}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-700">{testCase.expected_result}</p>
              )}
            </div>

            {/* Test Steps */}
            {testCase.test_steps && testCase.test_steps.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">테스트 스텝</h2>
                <div className="space-y-4">
                  {testCase.test_steps.map((step) => (
                    <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full mr-3">
                          Step {step.step_number}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2"><strong>Action:</strong> {step.action}</p>
                      <p className="text-gray-600"><strong>Expected:</strong> {step.expected_result}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">상태 정보</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                  {isEditing ? (
                    <select
                      value={editForm.priority || ''}
                      onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">낮음</option>
                      <option value="medium">보통</option>
                      <option value="high">높음</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(testCase.priority)}`}>
                      {getPriorityLabel(testCase.priority)}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                  {isEditing ? (
                    <select
                      value={editForm.status || ''}
                      onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="not_run">미실행</option>
                      <option value="pass">통과</option>
                      <option value="fail">실패</option>
                      <option value="na">해당없음</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(testCase.status)}`}>
                      {getStatusLabel(testCase.status)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <TagIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">카테고리</span>
                  <span className="ml-auto text-sm font-medium text-gray-900">{testCase.category_name}</span>
                </div>
                <div className="flex items-center">
                  <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">작성자</span>
                  <span className="ml-auto text-sm font-medium text-gray-900">{testCase.created_by_name}</span>
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">작성일</span>
                  <span className="ml-auto text-sm font-medium text-gray-900">
                    {new Date(testCase.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                {testCase.updated_at !== testCase.created_at && (
                  <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">수정일</span>
                    <span className="ml-auto text-sm font-medium text-gray-900">
                      {new Date(testCase.updated_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
