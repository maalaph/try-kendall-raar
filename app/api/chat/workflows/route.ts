import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';
import { formatPhoneNumberToE164 } from '@/lib/vapi';

interface WorkflowStep {
  type: 'call' | 'message' | 'schedule' | 'wait' | 'condition';
  config: Record<string, any>;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  enabled: boolean;
}

/**
 * POST /api/chat/workflows
 * Execute a multi-step workflow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, workflowId, workflow } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId is required' },
        { status: 400 }
      );
    }

    // Get user record
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    const agentId = userRecord.fields.vapi_agent_id;
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Execute workflow steps
    const results: Array<{ step: number; type: string; success: boolean; result?: any; error?: string }> = [];

    if (workflow && workflow.steps) {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        try {
          if (step.type === 'call') {
            const normalizedPhone = formatPhoneNumberToE164(step.config.phone_number);
            if (!normalizedPhone) {
              results.push({
                step: i + 1,
                type: 'call',
                success: false,
                error: 'Invalid phone number',
              });
              continue;
            }

            const callResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/make-call`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone_number: normalizedPhone,
                message: step.config.message,
                owner_agent_id: String(agentId),
              }),
            });

            const callResult = await callResponse.json();
            results.push({
              step: i + 1,
              type: 'call',
              success: callResponse.ok,
              result: callResult,
            });
          } else if (step.type === 'wait') {
            // Wait for specified duration (in seconds)
            await new Promise(resolve => setTimeout(resolve, (step.config.duration || 0) * 1000));
            results.push({
              step: i + 1,
              type: 'wait',
              success: true,
            });
          } else if (step.type === 'condition') {
            // Skip conditional steps for now (would need workflow engine)
            results.push({
              step: i + 1,
              type: 'condition',
              success: true,
              result: { skipped: true },
            });
          }
        } catch (error) {
          results.push({
            step: i + 1,
            type: step.type,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      completed: results.every(r => r.success),
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/workflows failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute workflow',
      },
      { status: 500 }
    );
  }
}



