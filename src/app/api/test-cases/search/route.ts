import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract search parameters
    const query = searchParams.get('query') || '';
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const project = searchParams.get('project') || '';
    const tags = searchParams.get('tags') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const suggestions = searchParams.get('suggestions') === 'true';

    // Build the base query
    let sqlQuery = `
      SELECT 
        tc.*,
        tcat.name as category_name,
        p.name as project_name,
        u.username as created_by_name
      FROM test_cases tc
      LEFT JOIN test_categories tcat ON tc.category_id = tcat.id
      LEFT JOIN projects p ON tc.project_id = p.id
      LEFT JOIN users u ON tc.created_by = u.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Add search conditions
    if (query) {
      conditions.push(`(tc.title LIKE ? OR tc.description LIKE ? OR tcat.name LIKE ?)`);
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      conditions.push('tc.status = ?');
      params.push(status);
    }

    if (priority) {
      conditions.push('tc.priority = ?');
      params.push(priority);
    }

    if (project) {
      conditions.push('tc.project_id = ?');
      params.push(project);
    }

    if (dateFrom) {
      conditions.push('tc.created_at >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('tc.created_at <= ?');
      params.push(dateTo + ' 23:59:59');
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      sqlQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Add ORDER BY
    sqlQuery += ` ORDER BY tc.${sortBy} ${sortOrder.toUpperCase()}`;

    // Get total count for pagination
    const countQuery = sqlQuery.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = db.prepare(countQuery).get(params);
    const totalCount = countResult ? countResult.total : 0;

    // Add pagination
    const offset = (page - 1) * limit;
    sqlQuery += ` LIMIT ${limit} OFFSET ${offset}`;

    const testCases = db.prepare(sqlQuery).all(params) as any[];

    // Get search suggestions if requested
    if (suggestions && query) {
      const suggestionsQuery = `
        SELECT DISTINCT tc.title, tc.description, tcat.name as category_name
        FROM test_cases tc
        LEFT JOIN test_categories tcat ON tc.category_id = tcat.id
        WHERE tc.title LIKE ? OR tc.description LIKE ? OR tcat.name LIKE ?
        LIMIT 10
      `;
      const suggestionTerm = `%${query}%`;
      const suggestionsList = db.prepare(suggestionsQuery).all(suggestionTerm, suggestionTerm, suggestionTerm);
      
      const uniqueSuggestions = new Set<string>();
      suggestionsList.forEach((item: any) => {
        if (item.title) uniqueSuggestions.add(item.title);
        if (item.description) uniqueSuggestions.add(item.description);
        if (item.category_name) uniqueSuggestions.add(item.category_name);
      });

      return NextResponse.json({ 
        suggestions: Array.from(uniqueSuggestions).slice(0, 10) 
      });
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      testCases: testCases,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      filters: {
        applied: {
          query,
          status,
          priority,
          project,
          tags,
          dateFrom,
          dateTo
        },
        totalResults: totalCount
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
