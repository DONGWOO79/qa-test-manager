import { ITestCase } from '@/types';

export interface SearchFilters {
  query: string;
  status: string;
  priority: string;
  project: string;
  tags: string;
  dateFrom: string;
  dateTo: string;
}

export function filterTestCases(testCases: ITestCase[], filters: SearchFilters): ITestCase[] {
  return testCases.filter(testCase => {
    // Text search (title, description, steps, expected_results)
    if (filters.query) {
      const searchText = filters.query.toLowerCase();
      const searchableFields = [
        testCase.title,
        testCase.description,
        testCase.steps,
        testCase.expected_results,
        testCase.actual_results || ''
      ].join(' ').toLowerCase();
      
      if (!searchableFields.includes(searchText)) {
        return false;
      }
    }

    // Status filter
    if (filters.status && testCase.status !== filters.status) {
      return false;
    }

    // Priority filter
    if (filters.priority && testCase.priority !== filters.priority) {
      return false;
    }

    // Project filter
    if (filters.project && testCase.test_suite_id.toString() !== filters.project) {
      return false;
    }

    // Tags filter
    if (filters.tags) {
      const tagSearch = filters.tags.toLowerCase();
      const testCaseTags = testCase.tags.toLowerCase();
      if (!testCaseTags.includes(tagSearch)) {
        return false;
      }
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const testCaseDate = new Date(testCase.created_at);
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        if (testCaseDate < fromDate) {
          return false;
        }
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (testCaseDate > toDate) {
          return false;
        }
      }
    }

    return true;
  });
}

export function sortTestCases(testCases: ITestCase[], sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): ITestCase[] {
  const sortedCases = [...testCases];
  
  sortedCases.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'priority':
        aValue = a.priority;
        bValue = b.priority;
        break;
      case 'created_at':
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
        break;
      case 'updated_at':
        aValue = new Date(a.updated_at);
        bValue = new Date(b.updated_at);
        break;
      default:
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
    }

    if (aValue < bValue) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return sortedCases;
}

export function getSearchSuggestions(testCases: ITestCase[], query: string): string[] {
  if (!query || query.length < 2) return [];

  const suggestions = new Set<string>();
  const queryLower = query.toLowerCase();

  testCases.forEach(testCase => {
    // Extract words from title and description
    const words = [
      ...testCase.title.split(/\s+/),
      ...testCase.description.split(/\s+/),
      ...testCase.tags.split(',').map(tag => tag.trim())
    ];

    words.forEach(word => {
      const wordLower = word.toLowerCase();
      if (wordLower.startsWith(queryLower) && wordLower.length > 2) {
        suggestions.add(word);
      }
    });
  });

  return Array.from(suggestions).slice(0, 10); // Limit to 10 suggestions
}
