import { SearchFilters } from '@/lib/search/filterUtils';
import { XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';

interface SearchResultsSummaryProps {
  totalResults: number;
  appliedFilters: SearchFilters;
  onClearFilter: (filterKey: keyof SearchFilters) => void;
  onClearAllFilters: () => void;
}

export default function SearchResultsSummary({
  totalResults,
  appliedFilters,
  onClearFilter,
  onClearAllFilters
}: SearchResultsSummaryProps) {
  const activeFilters = Object.entries(appliedFilters).filter(([_, value]) => value !== '');

  if (activeFilters.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              총 {totalResults}개의 테스트 케이스
            </span>
          </div>
        </div>
      </div>
    );
  }

  const getFilterLabel = (key: string, value: string) => {
    switch (key) {
      case 'query':
        return `검색어: "${value}"`;
      case 'status':
        return `상태: ${value}`;
      case 'priority':
        return `우선순위: ${value}`;
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
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            검색 결과: {totalResults}개
          </span>
        </div>
        <button
          onClick={onClearAllFilters}
          className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
        >
          모든 필터 초기화
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeFilters.map(([key, value]) => (
          <div
            key={key}
            className="inline-flex items-center bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
          >
            <span>{getFilterLabel(key, value)}</span>
            <button
              onClick={() => onClearFilter(key as keyof SearchFilters)}
              className="ml-2 hover:bg-blue-200 rounded-full p-0.5"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
