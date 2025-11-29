import { createBusinessTrialRecord } from '@/lib/airtable';
import { sendBusinessTrialWelcomeEmail } from '@/lib/email';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Rate limiting: 5 requests per 15 minutes per IP
  const clientIP = getClientIP(request);
  const rateLimitResult = rateLimit(clientIP, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }

  try {
    // Parse request body
    const body = await request.json();
    const { 
      fullName, 
      businessName, 
      phone, 
      email, 
      website, 
      bookingSystem,
      // Configurator fields
      businessType,
      callVolume,
      callDuration,
      selectedAddOns,
      phoneLines,
      recommendedPlan,
    } = body;

    // Validate required fields
    if (!fullName || !businessName || !phone || !email) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: fullName, businessName, phone, and email are required' 
        },
        { status: 400 }
      );
    }

    // Prepare fields for Airtable
    const fields: Record<string, any> = {
      fullName,
      businessName,
      phone,
      email,
    };

    // Try to add created_at timestamp
    // Format as ISO string for Airtable Date with time field
    // If Airtable rejects it (e.g., field is auto-populated), we'll handle it in the catch block
    fields.created_at = new Date().toISOString();

    // Add optional fields if provided
    if (website) {
      fields.website = website;
    }
    if (bookingSystem) {
      fields.bookingSystem = bookingSystem;
    }

    // Add configurator fields if provided
    if (businessType !== undefined && businessType !== null) {
      fields.businessType = businessType;
    }
    if (callVolume !== undefined && callVolume !== null) {
      fields.callVolume = typeof callVolume === 'number' ? callVolume : parseFloat(callVolume) || 0;
    }
    if (callDuration !== undefined && callDuration !== null) {
      fields.callDuration = typeof callDuration === 'number' ? callDuration : parseFloat(callDuration) || 0;
    }
    if (selectedAddOns !== undefined && selectedAddOns !== null) {
      // selectedAddOns comes as comma-separated string from frontend
      fields.selectedAddOns = selectedAddOns;
    }
    if (phoneLines !== undefined && phoneLines !== null) {
      fields.phoneLines = typeof phoneLines === 'number' ? phoneLines : parseInt(phoneLines) || 0;
    }
    if (recommendedPlan !== undefined && recommendedPlan !== null) {
      fields.recommendedPlan = recommendedPlan;
    }

    // Create Airtable record
    // Try with created_at first, if it fails, retry without it
    let airtableRecord;
    let recordId;
    
    try {
      airtableRecord = await createBusinessTrialRecord(fields);
      recordId = airtableRecord.id;
    } catch (error) {
      // If error is about created_at field, try again without it
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('created_at') || errorMessage.includes('cannot accept')) {
        console.log('[INFO] created_at field rejected, retrying without it');
        const fieldsWithoutTimestamp = { ...fields };
        delete fieldsWithoutTimestamp.created_at;
        airtableRecord = await createBusinessTrialRecord(fieldsWithoutTimestamp);
        recordId = airtableRecord.id;
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }

    console.log('[BUSINESS TRIAL SUCCESS] Record created:', recordId);

    // Send welcome email
    try {
      await sendBusinessTrialWelcomeEmail({
        to: email,
        fullName,
        businessName,
      });
      console.log('[EMAIL SUCCESS] Welcome email sent to:', email);
    } catch (emailError) {
      // Log email error but don't fail the request - record was created successfully
      console.error('[EMAIL ERROR] Failed to send welcome email:', emailError);
      // Continue with successful response even if email fails
    }

    return NextResponse.json({
      success: true,
      recordId,
    });
  } catch (error) {
    console.error('[ERROR] createBusinessTrial failed:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create business trial signup' 
      },
      { status: 500 }
    );
  }
}

