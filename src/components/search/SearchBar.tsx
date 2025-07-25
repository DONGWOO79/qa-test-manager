'use client';

import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SearchSuggestions from './SearchSuggestions';
import SearchResultsSummary from './SearchResultsSummary';
import { SearchFilters } from '@/lib/search/filterUtils';

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  projects: Array<{ id: number; name: string }>;
  totalResults: number;
  appliedFilters: SearchFilters;
  onClearFilter: (key: keyof SearchFilters) => void;
  onClearAllFilters: () => void;
}

export default function SearchBar({ 
  onSearch, 
  projects, 
  totalResults, 
  appliedFilters, 
  onClearFilter, 
  onClearAllFilters 
}: SearchBarProps) {
  const [filters, setFilters] = useState<SearchFilters>(appliedFilters);
  const [localQuery, setLocalQuery] = useState(filters.query);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLocalQuery(filters.query);
  }, [filters.query]);

  const handleQueryChange = (value: string) => {
    setLocalQuery(value);
  };

  const handleSearchSubmit = () => {
    const newFilters = { ...filters, query: localQuery };
    setFilters(newFilters);
    onSearch(newFilters);
  };

  const handleInputChange = (field: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    if (field !== 'query') {
      onSearch(newFilters);
    }
  };

  const hasActiveFilters = Object.values(appliedFilters).some(value => value !== '');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <SearchSuggestions
              query={localQuery}
              onQueryChange={handleQueryChange}
              onSuggestionSelect={(suggestion) => {
                setLocalQuery(suggestion);
                const newFilters = { ...filters, query: suggestion };
                setFilters(newFilters);
                onSearch(newFilters);
              }}
              onSearchSubmit={handleSearchSubmit}
              placeholder="테스트 케이스 검색..."
            />
          </div>
          <button
            onClick={handleSearchSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            검색
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters 
                ? 'bg-blue-100 text-blue-600' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상태
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">전체</option>
                  <option value="pass">통과</option>
                  <option value="fail">실패</option>
                  <option value="na">해당없음</option>
                  <option value="not_run">미실행</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  우선순위
                </label>
                <select
                  value={filters.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">전체</option>
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  프로젝트
                </label>
                <select
                  value={filters.project}
                  onChange={(e) => handleInputChange('project', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">전체</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id.toString()}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  태그
                </label>
                <input
                  type="text"
                  value={filters.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  placeholder="태그 검색..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <SearchResultsSummary
          totalResults={totalResults}
          appliedFilters={appliedFilters}
          onClearFilter={onClearFilter}
          onClearAllFilters={onClearAllFilters}
        />
      )}
    </div>
  );
}
