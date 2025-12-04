# Spotify Airtable Fields Setup

## Problem
The Spotify OAuth flow is working correctly, but it's failing to save because the required fields don't exist in your Airtable table.

**Error:** `Unknown field name: "Spotify OAuth Access Token"`

## Required Fields to Add

Go to your Airtable base and add these fields to your User Records table (`tblEXG9wp3Dm3nPte`):

### 1. Spotify OAuth Access Token
- **Type:** Single line text
- **Name:** `Spotify OAuth Access Token`
- **Description:** Stores the Spotify access token (encrypted/sensitive)

### 2. Spotify OAuth Refresh Token
- **Type:** Single line text  
- **Name:** `Spotify OAuth Refresh Token`
- **Description:** Stores the Spotify refresh token (encrypted/sensitive)

### 3. Spotify OAuth Token Expiry
- **Type:** Date & time
- **Name:** `Spotify OAuth Token Expiry`
- **Description:** When the access token expires

### 4. Spotify Connected
- **Type:** Checkbox
- **Name:** `Spotify Connected`
- **Description:** Whether Spotify account is connected

### 5. Spotify User ID
- **Type:** Single line text
- **Name:** `Spotify User ID`
- **Description:** Spotify user's unique ID

### 6. Spotify Display Name
- **Type:** Single line text
- **Name:** `Spotify Display Name`
- **Description:** User's Spotify display name

### 7. Spotify Email
- **Type:** Email
- **Name:** `Spotify Email`
- **Description:** User's Spotify email address

### 8. Spotify Last Sync
- **Type:** Date & time
- **Name:** `Spotify Last Sync`
- **Description:** Last time Spotify data was synced

## Quick Steps

1. Go to your Airtable base: `appRzrock4whokZZ7`
2. Open the table: `tblEXG9wp3Dm3nPte` (User Records)
3. Click the "+" button to add each field above
4. Make sure the field names match **exactly** as shown (case-sensitive)
5. Once all fields are added, try connecting Spotify again

## Field Summary

| Field Name | Type | Required |
|------------|------|----------|
| Spotify OAuth Access Token | Single line text | ✅ |
| Spotify OAuth Refresh Token | Single line text | ✅ |
| Spotify OAuth Token Expiry | Date & time | ✅ |
| Spotify Connected | Checkbox | ✅ |
| Spotify User ID | Single line text | ✅ |
| Spotify Display Name | Single line text | ✅ |
| Spotify Email | Email | ✅ |
| Spotify Last Sync | Date & time | ✅ |

After adding these fields, the Spotify connection will work perfectly!



