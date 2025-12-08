/**
 * Approval Handler for Human-in-the-Loop (HITL) System
 * Manages approval requests for sensitive agent actions
 */

import { supabase } from '../supabase';

export type ApprovalType = 
  | 'purchase'      // Any purchase transaction
  | 'payment'       // Paying bills, invoices
  | 'transfer'      // Money transfers
  | 'booking'       // Expensive bookings/services
  | 'subscription'  // Subscription changes
  | 'financial'     // Any financial action
  | 'irreversible'; // Actions that can't be undone

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  userId: string;
  actionType: ApprovalType;
  actionParams: Record<string, any>;
  status: ApprovalStatus;
  message?: string;
  context?: Record<string, any>;
  threadId?: string;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CreateApprovalParams {
  userId: string;
  actionType: ApprovalType;
  actionParams: Record<string, any>;
  message?: string;
  context?: Record<string, any>;
  threadId?: string;
  expiresInHours?: number;
}

export interface ApprovalDecision {
  approvalId: string;
  decision: 'approved' | 'rejected';
  resolvedBy?: string;
  notes?: string;
}

/**
 * Create a new approval request
 */
export async function createApprovalRequest(params: CreateApprovalParams): Promise<ApprovalRequest> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (params.expiresInHours || 24));
  
  const { data, error } = await supabase
    .from('pending_approvals')
    .insert({
      user_id: params.userId,
      action_type: params.actionType,
      action_params: params.actionParams,
      message: params.message,
      context: params.context || {},
      thread_id: params.threadId,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();
  
  if (error) {
    console.error('[APPROVAL] Failed to create approval request:', error);
    throw new Error(`Failed to create approval request: ${error.message}`);
  }
  
  console.log('[APPROVAL] Created approval request:', {
    id: data.id,
    actionType: params.actionType,
    userId: params.userId,
  });
  
  return transformApprovalRecord(data);
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
  const { data, error } = await supabase
    .from('pending_approvals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[APPROVAL] Failed to get pending approvals:', error);
    throw new Error(`Failed to get pending approvals: ${error.message}`);
  }
  
  return (data || []).map(transformApprovalRecord);
}

/**
 * Get all approvals for a user (with optional status filter)
 */
export async function getApprovals(
  userId: string,
  options?: {
    status?: ApprovalStatus;
    limit?: number;
    offset?: number;
  }
): Promise<ApprovalRequest[]> {
  let query = supabase
    .from('pending_approvals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[APPROVAL] Failed to get approvals:', error);
    throw new Error(`Failed to get approvals: ${error.message}`);
  }
  
  return (data || []).map(transformApprovalRecord);
}

/**
 * Get a single approval by ID
 */
export async function getApprovalById(approvalId: string): Promise<ApprovalRequest | null> {
  const { data, error } = await supabase
    .from('pending_approvals')
    .select('*')
    .eq('id', approvalId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[APPROVAL] Failed to get approval:', error);
    throw new Error(`Failed to get approval: ${error.message}`);
  }
  
  return transformApprovalRecord(data);
}

/**
 * Resolve an approval request (approve or reject)
 */
export async function resolveApproval(decision: ApprovalDecision): Promise<ApprovalRequest> {
  const { data, error } = await supabase
    .from('pending_approvals')
    .update({
      status: decision.decision,
      resolved_at: new Date().toISOString(),
      resolved_by: decision.resolvedBy || 'user',
      context: decision.notes ? { notes: decision.notes } : undefined,
    })
    .eq('id', decision.approvalId)
    .eq('status', 'pending') // Only update if still pending
    .select('*')
    .single();
  
  if (error) {
    console.error('[APPROVAL] Failed to resolve approval:', error);
    throw new Error(`Failed to resolve approval: ${error.message}`);
  }
  
  console.log('[APPROVAL] Resolved approval:', {
    id: decision.approvalId,
    decision: decision.decision,
  });
  
  return transformApprovalRecord(data);
}

/**
 * Cancel an approval request
 */
export async function cancelApproval(approvalId: string): Promise<ApprovalRequest> {
  const { data, error } = await supabase
    .from('pending_approvals')
    .update({
      status: 'cancelled',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('status', 'pending')
    .select('*')
    .single();
  
  if (error) {
    console.error('[APPROVAL] Failed to cancel approval:', error);
    throw new Error(`Failed to cancel approval: ${error.message}`);
  }
  
  return transformApprovalRecord(data);
}

/**
 * Check if an action requires approval
 */
export function requiresApproval(
  actionType: string,
  actionParams: Record<string, any>
): { required: boolean; type?: ApprovalType; reason?: string } {
  // Define approval rules
  const approvalRules: Array<{
    pattern: RegExp | string;
    type: ApprovalType;
    condition?: (params: Record<string, any>) => boolean;
    reason: string;
  }> = [
    // Purchase actions
    {
      pattern: /purchase|buy|order/i,
      type: 'purchase',
      reason: 'This action involves a purchase.',
    },
    
    // Payment actions
    {
      pattern: /pay|payment|invoice/i,
      type: 'payment',
      reason: 'This action involves a payment.',
    },
    
    // Transfer actions
    {
      pattern: /transfer|send_money|wire/i,
      type: 'transfer',
      reason: 'This action involves a money transfer.',
    },
    
    // Booking actions (expensive ones)
    {
      pattern: /book|reserve|schedule_service/i,
      type: 'booking',
      condition: (params) => {
        const amount = params.amount || params.price || params.cost || 0;
        return amount > 50; // Only require approval for bookings over $50
      },
      reason: 'This booking exceeds the auto-approval threshold.',
    },
    
    // Subscription actions
    {
      pattern: /subscribe|subscription|recurring/i,
      type: 'subscription',
      reason: 'This action creates a recurring charge.',
    },
    
    // Irreversible actions
    {
      pattern: /delete|remove|cancel_subscription|terminate/i,
      type: 'irreversible',
      reason: 'This action cannot be undone.',
    },
  ];
  
  for (const rule of approvalRules) {
    const matches = typeof rule.pattern === 'string'
      ? actionType.toLowerCase().includes(rule.pattern.toLowerCase())
      : rule.pattern.test(actionType);
    
    if (matches) {
      // Check additional condition if exists
      if (rule.condition && !rule.condition(actionParams)) {
        continue;
      }
      
      return {
        required: true,
        type: rule.type,
        reason: rule.reason,
      };
    }
  }
  
  return { required: false };
}

/**
 * Check if approval is still valid (not expired)
 */
export function isApprovalValid(approval: ApprovalRequest): boolean {
  if (approval.status !== 'pending') {
    return false;
  }
  
  const expiresAt = new Date(approval.expiresAt);
  return expiresAt > new Date();
}

/**
 * Get approval statistics for a user
 */
export async function getApprovalStats(userId: string): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  total: number;
}> {
  const { data, error } = await supabase
    .from('pending_approvals')
    .select('status')
    .eq('user_id', userId);
  
  if (error) {
    console.error('[APPROVAL] Failed to get stats:', error);
    return { pending: 0, approved: 0, rejected: 0, expired: 0, total: 0 };
  }
  
  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    total: data?.length || 0,
  };
  
  for (const record of data || []) {
    switch (record.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'approved':
        stats.approved++;
        break;
      case 'rejected':
        stats.rejected++;
        break;
      case 'expired':
        stats.expired++;
        break;
    }
  }
  
  return stats;
}

/**
 * Transform database record to ApprovalRequest
 */
function transformApprovalRecord(record: any): ApprovalRequest {
  return {
    id: record.id,
    userId: record.user_id,
    actionType: record.action_type as ApprovalType,
    actionParams: record.action_params || {},
    status: record.status as ApprovalStatus,
    message: record.message,
    context: record.context,
    threadId: record.thread_id,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    resolvedAt: record.resolved_at,
    resolvedBy: record.resolved_by,
  };
}

/**
 * Generate human-readable message for approval request
 */
export function formatApprovalMessage(approval: ApprovalRequest): string {
  const { actionType, actionParams } = approval;
  
  switch (actionType) {
    case 'purchase':
      return `Purchase request: ${actionParams.item || 'item'} for ${formatCurrency(actionParams.amount)}`;
    
    case 'payment':
      return `Payment request: ${formatCurrency(actionParams.amount)} to ${actionParams.recipient || 'recipient'}`;
    
    case 'transfer':
      return `Transfer request: ${formatCurrency(actionParams.amount)} to ${actionParams.destination || 'destination'}`;
    
    case 'booking':
      return `Booking request: ${actionParams.service || 'service'} for ${formatCurrency(actionParams.amount)}`;
    
    case 'subscription':
      return `Subscription request: ${actionParams.plan || 'plan'} at ${formatCurrency(actionParams.amount)}/month`;
    
    case 'irreversible':
      return `Irreversible action: ${actionParams.action || 'action'} - ${actionParams.description || 'This cannot be undone'}`;
    
    default:
      return approval.message || `Action requires approval: ${actionType}`;
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) {
    return '$?.??';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}



