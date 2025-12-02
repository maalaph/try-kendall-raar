# Google OAuth Airtable Schema Setup

This guide explains how to add the required fields to your Airtable table for Google OAuth integration.

## Required Fields

Add these fields to your user records table in Airtable:

### 1. Google OAuth Access Token
- **Field Type**: Single line text
- **Field Name**: `Google OAuth Access Token`
- **Options**: 
  - Mark as **Private/Encrypted** (if available)
  - This field stores the OAuth access token

### 2. Google OAuth Refresh Token
- **Field Type**: Single line text
- **Field Name**: `Google OAuth Refresh Token`
- **Options**: 
  - Mark as **Private/Encrypted** (if available)
  - This field stores the OAuth refresh token (used to get new access tokens)

### 3. Google OAuth Token Expiry
- **Field Type**: Date
- **Field Name**: `Google OAuth Token Expiry`
- **Options**: 
  - Include time: **Yes**
  - Time zone: Your preferred timezone
  - This field stores when the access token expires

### 4. Google Calendar Connected
- **Field Type**: Checkbox
- **Field Name**: `Google Calendar Connected`
- **Options**: 
  - Default value: **Unchecked**
  - This field indicates if Calendar is connected

### 5. Google Gmail Connected
- **Field Type**: Checkbox
- **Field Name**: `Google Gmail Connected`
- **Options**: 
  - Default value: **Unchecked**
  - This field indicates if Gmail is connected

### 6. Google Email
- **Field Type**: Email
- **Field Name**: `Google Email`
- **Options**: 
  - This field stores the user's Google email address for verification

## Step-by-Step Instructions

1. **Open your Airtable base**
   - Navigate to your Airtable workspace
   - Open the base containing your user records table

2. **Add the fields**
   - Click on the table header to open field options
   - Click "Add a field" or use the "+" button
   - For each field above:
     - Enter the exact field name
     - Select the correct field type
     - Configure options as specified

3. **Set field privacy (if available)**
   - For `Google OAuth Access Token` and `Google OAuth Refresh Token`:
     - Right-click the field
     - Look for "Mark as private" or "Encrypt" option
     - Enable it to protect sensitive token data

4. **Verify field names**
   - Field names must match exactly (case-sensitive):
     - `Google OAuth Access Token`
     - `Google OAuth Refresh Token`
     - `Google OAuth Token Expiry`
     - `Google Calendar Connected`
     - `Google Gmail Connected`
     - `Google Email`

## Field Mapping Reference

The code uses these exact field names when reading/writing to Airtable:

```typescript
{
  'Google OAuth Access Token': string,
  'Google OAuth Refresh Token': string,
  'Google OAuth Token Expiry': string (ISO date),
  'Google Calendar Connected': boolean,
  'Google Gmail Connected': boolean,
  'Google Email': string
}
```

## Testing

After adding the fields:

1. Verify all 6 fields exist in your table
2. Check that field names match exactly (including spaces and capitalization)
3. Test the OAuth connection flow:
   - Connect a Google account
   - Verify fields are populated correctly
   - Check that tokens are stored securely

## Security Best Practices

- **Mark token fields as private/encrypted** if your Airtable plan supports it
- **Limit access** to the Airtable base to authorized users only
- **Never expose** access tokens or refresh tokens in logs or client-side code
- **Rotate credentials** if tokens are ever compromised

## Troubleshooting

### "Field not found" errors
- Verify field names match exactly (case-sensitive)
- Check for extra spaces in field names
- Ensure fields are in the correct table

### Token storage issues
- Verify field types are correct (text for tokens, date for expiry)
- Check that fields are not read-only
- Ensure your Airtable API key has write permissions

### Connection status not updating
- Verify checkbox fields are properly configured
- Check that boolean values are being set correctly
- Review Airtable API response for errors

