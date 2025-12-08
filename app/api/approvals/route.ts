/**
 * Approvals API Endpoint
 * Manages approval requests for sensitive agent actions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingApprovals,
  getApprovals,
  getApprovalById,
  createApprovalRequest,
  resolveApproval,
  cancelApproval,
  getApprovalStats,
  formatApprovalMessage,
  ApprovalType,
} from '@/lib/agent/approvalHandler';

/**
 * GET /api/approvals
 * Get approvals for a user
 * Query params: userId, status, limit, offset, id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const approvalId = searchParams.get('id');
    const status = searchParams.get('status') as any;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeStats = searchParams.get('stats') === 'true';
    
    // Get single approval by ID
    if (approvalId) {
      const approval = await getApprovalById(approvalId);
      
      if (!approval) {
        return NextResponse.json(
          { error: 'Approval not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        approval,
        message: formatApprovalMessage(approval),
      });
    }
    
    // User ID required for list queries
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // Get pending approvals (default) or filtered list
    let approvals;
    if (status === 'pending') {
      approvals = await getPendingApprovals(userId);
    } else {
      approvals = await getApprovals(userId, { status, limit, offset });
    }
    
    // Include stats if requested
    let stats;
    if (includeStats) {
      stats = await getApprovalStats(userId);
    }
    
    // Format messages for each approval
    const approvalsWithMessages = approvals.map(approval => ({
      ...approval,
      formattedMessage: formatApprovalMessage(approval),
    }));
    
    return NextResponse.json({
      approvals: approvalsWithMessages,
      count: approvals.length,
      stats,
    });
  } catch (error) {
    console.error('[API] GET /api/approvals error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals
 * Create a new approval request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { userId, actionType, actionParams, message, context, threadId, expiresInHours } = body;
    
    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    if (!actionType) {
      return NextResponse.json(
        { error: 'actionType is required' },
        { status: 400 }
      );
    }
    
    // Validate action type
    const validTypes: ApprovalType[] = [
      'purchase', 'payment', 'transfer', 'booking', 
      'subscription', 'financial', 'irreversible'
    ];
    
    if (!validTypes.includes(actionType)) {
      return NextResponse.json(
        { error: `Invalid actionType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Create approval request
    const approval = await createApprovalRequest({
      userId,
      actionType,
      actionParams: actionParams || {},
      message,
      context,
      threadId,
      expiresInHours,
    });
    
    return NextResponse.json({
      success: true,
      approval,
      message: formatApprovalMessage(approval),
    });
  } catch (error) {
    console.error('[API] POST /api/approvals error:', error);
    return NextResponse.json(
      { error: 'Failed to create approval', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/approvals
 * Resolve (approve/reject) or cancel an approval
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { approvalId, decision, notes, cancel } = body;
    
    if (!approvalId) {
      return NextResponse.json(
        { error: 'approvalId is required' },
        { status: 400 }
      );
    }
    
    let approval;
    
    // Handle cancellation
    if (cancel) {
      approval = await cancelApproval(approvalId);
      return NextResponse.json({
        success: true,
        approval,
        message: 'Approval cancelled',
      });
    }
    
    // Handle approval/rejection
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { error: 'decision must be either "approved" or "rejected"' },
        { status: 400 }
      );
    }
    
    approval = await resolveApproval({
      approvalId,
      decision,
      notes,
    });

    // If purchase was approved, trigger purchase execution (virtual card creation)
    if (decision === 'approved' && approval.actionType === 'purchase') {
      try {
        const { supabase } = await import('@/lib/supabase');
        
        // Find the purchase request linked to this approval
        const { data: purchaseRequest } = await supabase
          .from('purchase_requests')
          .select('*')
          .eq('approval_id', approvalId)
          .single();

        if (purchaseRequest && purchaseRequest.status === 'pending_approval') {
          // Update purchase request status to approved
          await supabase
            .from('purchase_requests')
            .update({ status: 'approved' })
            .eq('id', purchaseRequest.id);

          // Process the approved purchase (create virtual card)
          const { processApprovedPurchase } = await import('@/lib/purchasing/purchaseProcessor');
          const cardResult = await processApprovedPurchase(purchaseRequest.id);

          console.log('[APPROVAL] Purchase approved, virtual card created:', {
            purchaseRequestId: purchaseRequest.id,
            cardToken: cardResult.cardToken,
            cardNumber: cardResult.cardNumber,
          });

          return NextResponse.json({
            success: true,
            approval,
            purchase: {
              purchase_request_id: purchaseRequest.id,
              card_created: true,
              card_number: cardResult.cardNumber,
            },
            message: `Purchase approved. Virtual card created ending in ${cardResult.cardNumber}.`,
          });
        }
      } catch (purchaseError) {
        console.error('[APPROVAL] Error processing approved purchase:', purchaseError);
        // Don't fail the approval - card creation can be retried
        return NextResponse.json({
          success: true,
          approval,
          warning: 'Purchase approved, but card creation failed. You may need to retry.',
          message: `Approval ${decision}`,
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      approval,
      message: `Approval ${decision}`,
    });
  } catch (error) {
    console.error('[API] PATCH /api/approvals error:', error);
    return NextResponse.json(
      { error: 'Failed to update approval', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



