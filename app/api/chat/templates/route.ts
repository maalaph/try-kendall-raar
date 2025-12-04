import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';
import { getAllTemplates, getTemplatesByCategory, renderTemplate } from '@/lib/templates';

/**
 * GET /api/chat/templates
 * Get available message templates
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');
    const category = searchParams.get('category') as any;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get user record to verify
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Get templates (would also fetch user-created templates from storage)
    const templates = category 
      ? getTemplatesByCategory(category)
      : getAllTemplates();

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/templates failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get templates',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/templates/render
 * Render a template with variables
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, variables } = body;

    if (!templateId || !variables) {
      return NextResponse.json(
        { success: false, error: 'templateId and variables are required' },
        { status: 400 }
      );
    }

    // Get template
    const templates = getAllTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Render template
    const rendered = renderTemplate(template, variables);

    return NextResponse.json({
      success: true,
      rendered,
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/templates/render failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to render template',
      },
      { status: 500 }
    );
  }
}




