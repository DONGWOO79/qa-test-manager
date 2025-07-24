import { useState } from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SearchSuggestions from './SearchSuggestions';
import SearchResultsSummary from './SearchResultsSummary';
import { SearchFilters } from '@/lib/search/filterUtils';

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  projects?: Array<{ id: number; name: string }>;
  totalResults?: number;
  appliedFilters?: SearchFilters;
  onClearFilter?: (filterKey: keyof SearchFilters) => void;
  onClearAllFilters?: () => void;
}

export default function SearchBar({ 
  onSearch, 
  projects = [],
  totalResults = 0,
  appliedFilters,
  onClearFilter,
  onClearAllFilters
}: SearchBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    status: '',
    priority: '',
    project: '',
    tags: '',
    dateFrom: '',
    dateTo: ''
  });

  const handleInputChange = (field: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onSearch(newFilters);
  };

  const handleClearFilter = (filterKey: keyof SearchFilters) => {
    const newFilters = { ...filters, [filterKey]: '' };
    setFilters(newFilters);
    onSearch(newFilters);
    onClearFilter?.(filterKey);
  };

  const handleClearAllFilters = () => {
    const clearedFilters = {
      query: '',
      status: '',
      priority: '',
      project: '',
      tags: '',
      dateFrom: '',
      dateTo: ''
    };
    setFilters(clearedFilters);
    onSearch(clearedFilters);
    onClearAllFilters?.();
  };

  return (
    <div className="space-y-4">
      {/* Basic Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <SearchSuggestions
              query={filters.query}
              onSuggestionSelect={(value) => handleInputChange('query', value)}
              placeholder="테스트 케이스 검색..."
            />
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FunnelIcon className="h-5 w-5" />
            <span>고급 필터</span>
          </button>
          {(filters.status || filters.priority || filters.project || filters.tags || filters.dateFrom || filters.dateTo) && (
            <button
              onClick={handleClearAllFilters}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
              <span>필터 초기화</span>
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">모든 상태</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                  <option value="NA">NA</option>
                  <option value="Holding">Holding</option>
                  <option value="Not Run">Not Run</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                <select
                  value={filters.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">모든 우선순위</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Project Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트</label>
                <select
                  value={filters.project}
                  onChange={(e) => handleInputChange('project', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">모든 프로젝트</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id.toString()}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
                <input
                  type="text"
                  placeholder="태그 검색..."
                  value={filters.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleInputChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleInputChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Results Summary */}
      {appliedFilters && onClearFilter && onClearAllFilters && (
        <SearchResultsSummary
          totalResults={totalResults}
          appliedFilters={appliedFilters}
          onClearFilter={handleClearFilter}
          onClearAllFilters={handleClearAllFilters}
        />
      )}
    </div>
  );
}
