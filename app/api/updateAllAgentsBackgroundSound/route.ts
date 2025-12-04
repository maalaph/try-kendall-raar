import { getAllUserRecords } from '@/lib/airtable';
import { updateAgentBackgroundSound } from '@/lib/vapi';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to update all existing agents to have background sound set to 'off'
 * This is a one-time migration/update script
 */
export async function POST(request: NextRequest) {
  try {
    // Get all records from Airtable
    console.log('[MIGRATION] Fetching all user records from Airtable...');
    const airtableData = await getAllUserRecords();
    const records = airtableData.records || [];

    console.log(`[MIGRATION] Found ${records.length} total records`);

    // Filter records that have an agent ID
    const recordsWithAgents = records.filter((record: any) => {
      const agentId = record.fields?.vapi_agent_id;
      return agentId && typeof agentId === 'string' && agentId.trim().length > 0;
    });

    console.log(`[MIGRATION] Found ${recordsWithAgents.length} records with agent IDs`);

    const results = {
      total: recordsWithAgents.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ agentId: string; error: string }>,
    };

    // Update each agent
    for (const record of recordsWithAgents) {
      const agentId = record.fields.vapi_agent_id;
      const fullName = record.fields.fullName || 'Unknown';
      const recordId = record.id;

      try {
        await updateAgentBackgroundSound(agentId, 'off');
        results.successful++;
        console.log(`[MIGRATION] ✓ Updated agent ${agentId} for ${fullName}`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({ agentId, error: errorMessage });
        console.error(`[MIGRATION] ✗ Failed to update agent ${agentId} for ${fullName}:`, errorMessage);
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[MIGRATION] Complete: ${results.successful} successful, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Updated ${results.successful} out of ${results.total} agents`,
      results,
    });
  } catch (error) {
    console.error('[ERROR] updateAllAgentsBackgroundSound failed:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update all agents' 
      },
      { status: 500 }
    );
  }
}
















