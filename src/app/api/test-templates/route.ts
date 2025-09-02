import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    let query = `
      SELECT 
        tt.*,
        tc.name as category_name,
        u.username as created_by_name
      FROM test_templates tt
      LEFT JOIN test_categories tc ON tt.category_id = tc.id
      LEFT JOIN users u ON tt.created_by = u.id
    `;

    const params: any[] = [];

    if (categoryId) {
      query += ' WHERE tt.category_id = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY tt.created_at DESC';

    const templates = db.prepare(query).all(params);

    // 각 템플릿의 변수들도 가져오기
    for (const template of templates) {
      const variables = db.prepare(`
        SELECT * FROM template_variables 
        WHERE template_id = ? 
        ORDER BY name
      `).all(template.id);
      template.variables = variables;
    }

    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category_id,
      steps,
      variables,
      created_by
    } = body;

    // 트랜잭션 시작
    const transaction = db.transaction(() => {
      // 템플릿 생성
      const result = db.prepare(`
        INSERT INTO test_templates (
          name, description, category_id, created_by
        ) VALUES (?, ?, ?, ?)
      `).run(name, description, category_id, created_by);

      const templateId = result.lastInsertRowid;

      // 변수들 생성
      if (variables && Array.isArray(variables)) {
        for (const variable of variables) {
          db.prepare(`
            INSERT INTO template_variables (
              template_id, name, description, default_value, required
            ) VALUES (?, ?, ?, ?, ?)
          `).run(templateId, variable.name, variable.description, variable.default_value, variable.required ? 1 : 0);
        }
      }

      return templateId;
    });

    const templateId = transaction();

    return NextResponse.json({ 
      success: true, 
      data: { id: templateId },
      message: 'Template created successfully' 
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
