'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface TestStep {
  id?: number;
  step_number: number;
  action: string;
  expected_result: string;
}

interface TestCaseFormProps {
  testCase?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export default function TestCaseForm({ testCase, onSave, onCancel }: TestCaseFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    priority: 'medium',
    expected_result: '',
    steps: [] as TestStep[]
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
    if (testCase) {
      setFormData({
        title: testCase.title || '',
        description: testCase.description || '',
        category_id: testCase.category_id || '',
        priority: testCase.priority || 'medium',
        expected_result: testCase.expected_result || '',
        steps: testCase.steps || []
      });
    } else {
      // 새 테스트 케이스인 경우 기본 스텝 추가
      setFormData(prev => ({
        ...prev,
        steps: [{ step_number: 1, action: '', expected_result: '' }]
      }));
    }
  }, [testCase]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const addStep = () => {
    const newStepNumber = formData.steps.length + 1;
    setFormData({
      ...formData,
      steps: [...formData.steps, { step_number: newStepNumber, action: '', expected_result: '' }]
    });
  };

  const removeStep = (index: number) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // 스텝 번호 재정렬
    const reorderedSteps = newSteps.map((step, i) => ({
      ...step,
      step_number: i + 1
    }));
    setFormData({
      ...formData,
      steps: reorderedSteps
    });
  };

  const updateStep = (index: number, field: keyof TestStep, value: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = {
      ...newSteps[index],
      [field]: value
    };
    setFormData({
      ...formData,
      steps: newSteps
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = testCase ? `/api/test-cases/${testCase.id}` : '/api/test-cases';
      const method = testCase ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        onSave(data);
      } else {
        alert('저장에 실패했습니다: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving test case:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        {testCase ? '테스트 케이스 수정' : '새 테스트 케이스 생성'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제목 *
            </label>
            <input
              type="text"
              name="title"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.title}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리 *
            </label>
            <select
              name="category_id"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.category_id}
              onChange={handleChange}
            >
              <option value="">카테고리 선택</option>
              {categories.map((category: any) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              우선순위
            </label>
            <select
              name="priority"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.priority}
              onChange={handleChange}
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </div>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설명
          </label>
          <textarea
            name="description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.description}
            onChange={handleChange}
          />
        </div>

        {/* 예상 결과 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            예상 결과
          </label>
          <textarea
            name="expected_result"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.expected_result}
            onChange={handleChange}
          />
        </div>

        {/* 테스트 스텝 */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-medium text-gray-700">
              테스트 스텝
            </label>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              스텝 추가
            </button>
          </div>

          <div className="space-y-4">
            {formData.steps.map((step, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    스텝 {step.step_number}
                  </span>
                  {formData.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      액션
                    </label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={step.action}
                      onChange={(e) => updateStep(index, 'action', e.target.value)}
                      placeholder="실행할 액션을 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      예상 결과
                    </label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={step.expected_result}
                      onChange={(e) => updateStep(index, 'expected_result', e.target.value)}
                      placeholder="예상되는 결과를 입력하세요"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : (testCase ? '수정' : '생성')}
          </button>
        </div>
      </form>
    </div>
  );
}
