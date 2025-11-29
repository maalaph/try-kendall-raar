# Business Trial Airtable Setup Guide

## Table Configuration

**Base ID:** `appRzrock4whokZZ7` (MyKendall)  
**Table ID:** `tbli3uJLbubkIRk5S` (Kendall Business)  
**Table Name:** Kendall Business

## Required Fields

The following fields must be created in your Airtable table with these exact names (case-sensitive):

### Required Fields

1. **`fullName`** (Single line text)
   - Contact person's full name
   - Required field

2. **`businessName`** (Single line text)
   - Name of the business
   - Required field

3. **`phone`** (Phone number)
   - Contact phone number
   - Required field

4. **`email`** (Email)
   - Contact email address
   - Required field

5. **`created_at`** (Date with time)
   - Timestamp when the record was created
   - Auto-populated by the API

### Optional Fields

6. **`website`** (URL)
   - Business website URL
   - Optional field

7. **`bookingSystem`** (Single line text)
   - Current booking system name (if any)
   - Optional field

8. **`notes`** (Long text)
   - Internal notes for the trial signup
   - Optional field

### Configurator Fields (Optional)

These fields are automatically populated from the configurator wizard when users configure their Kendall setup:

9. **`businessType`** (Single line text)
   - Type of business selected (e.g., "barbershops", "hair salons", "nail salons", "med spas")
   - Captured from configurator wizard
   - Optional field

10. **`selectedAddOns`** (Long text)
    - Comma-separated list of add-on IDs that the user selected
    - Example: "reminder-confirmation,post-appointment,waitlist-autofill"
    - Optional field

11. **`callVolume`** (Number)
    - Number of calls per day as selected in the call volume slider
    - Optional field

12. **`callDuration`** (Number)
    - Average call duration in minutes as selected in the call duration slider
    - Optional field

13. **`recommendedPlan`** (Single line text)
    - Recommended pricing plan based on call volume and duration
    - Values: "Starter", "Growth", "Professional", "Enterprise"
    - Optional field

14. **`phoneLines`** (Number)
    - Number of extra phone lines requested
    - Optional field

## Environment Variable

Add this to your `.env.local` file:

```
AIRTABLE_BUSINESS_TRIAL_TABLE_ID=tbli3uJLbubkIRk5S
```

## API Endpoint

**Endpoint:** `POST /api/createBusinessTrial`

**Request Body:**
```json
{
  "fullName": "John Doe",
  "businessName": "Acme Salon",
  "phone": "+1234567890",
  "email": "john@acme.com",
  "website": "https://acme.com",                    // optional
  "bookingSystem": "Square",                        // optional
  "businessType": "hair salons",                    // optional - from configurator
  "selectedAddOns": "reminder-confirmation,post-appointment", // optional - comma-separated
  "callVolume": 25,                                 // optional - calls per day
  "callDuration": 3,                                // optional - minutes per call
  "recommendedPlan": "Growth",                      // optional - calculated plan
  "phoneLines": 2                                   // optional - extra phone lines
}
```

**Response:**
```json
{
  "success": true,
  "recordId": "recXXXXXXXXXXXXXX"
}
```

## Flow

1. User configures Kendall Business using the configurator wizard (selects business type, add-ons, adjusts call volume/duration sliders)
2. User clicks "Start Free Trial" button
3. Trial form drawer opens
4. User fills out contact information (fullName, businessName, phone, email, optional website/bookingSystem)
5. Form submits to `/api/createBusinessTrial` with both contact info and configurator data
6. API creates record in Airtable with all form data and configurator selections
7. API sends welcome email to user with next steps
8. User receives confirmation
9. All data (including configurator selections) is available in Airtable for follow-up emails

## Notes

- All required fields must be present in the Airtable table
- Field names are case-sensitive
- The `created_at` field is automatically set by the API
- Email is sent automatically after successful record creation
- Email failures don't prevent record creation (logged but non-blocking)

