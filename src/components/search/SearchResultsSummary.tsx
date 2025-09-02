'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { SearchFilters } from '@/lib/search/filterUtils';

interface SearchResultsSummaryProps {
  totalResults: number;
  appliedFilters: SearchFilters;
  onClearFilter: (key: keyof SearchFilters) => void;
  onClearAllFilters: () => void;
}

export default function SearchResultsSummary({
  totalResults,
  appliedFilters,
  onClearFilter,
  onClearAllFilters
}: SearchResultsSummaryProps) {
  const activeFilters = Object.entries(appliedFilters).filter(([key, value]) => value !== '');

  if (activeFilters.length === 0) {
    return null;
  }

  const getFilterLabel = (key: string, value: string) => {
    switch (key) {
      case 'query':
        return `검색어: "${value}"`;
      case 'status':
        const statusLabels: { [key: string]: string } = {
          'pass': '통과',
          'fail': '실패',
          'na': '해당없음',
          'not_run': '미실행'
        };
        return `상태: ${statusLabels[value] || value}`;
      case 'priority':
        const priorityLabels: { [key: string]: string } = {
          'high': '높음',
          'medium': '보통',
          'low': '낮음'
        };
        return `우선순위: ${priorityLabels[value] || value}`;
      case 'project':
        return `프로젝트: ${value}`;
      case 'tags':
        return `태그: "${value}"`;
      case 'dateFrom':
        return `시작일: ${value}`;
      case 'dateTo':
        return `종료일: ${value}`;
      default:
        return `${key}: ${value}`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">적용된 필터:</span>
          <span className="text-sm text-gray-500">({totalResults}개 결과)</span>
        </div>
        <button
          onClick={onClearAllFilters}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
        >
          <XMarkIcon className="h-4 w-4 mr-1" />
          모든 필터 지우기
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeFilters.map(([key, value]) => (
          <div
            key={key}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
          >
            <span>{getFilterLabel(key, value)}</span>
            <button
              onClick={() => onClearFilter(key as keyof SearchFilters)}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
