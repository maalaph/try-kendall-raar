/**
 * Airtable helper function for saving My Kendall user data
 */

export async function saveMyKendallUser(data) {
  const { fullName, email, mobileNumber, forwardCalls, personality, userPrompt, attachedFiles } = data;

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;

  if (!apiKey || !baseId || !tableId) {
    throw new Error('Airtable configuration is missing. Please check your environment variables.');
  }

  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;

  // Prepare attachment field - Airtable expects array of objects with url property
  const attachmentArray = attachedFiles && attachedFiles.length > 0
    ? attachedFiles.map(file => ({ url: file.url }))
    : [];

  const fields = {
    fullName,
    email,
    mobileNumber,
    forwardCalls: forwardCalls ? 'Y' : 'N',
    personality: personality || '',
    userPrompt: userPrompt || '',
  };

  // Only add attachedFiles if there are files
  if (attachmentArray.length > 0) {
    fields.attachedFiles = attachmentArray;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
    console.error('Airtable API Error Details:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      url,
      baseId,
      tableId,
      fieldsBeingSent: fields,
    });
    
    // Provide more helpful error message
    if (response.status === 404) {
      throw new Error('Base or table not found. Please verify your Base ID and Table ID are correct.');
    } else if (response.status === 403) {
      throw new Error('Permission denied. Please check that your token has write access to this base.');
    } else if (errorData.error?.type === 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND') {
      throw new Error('Field names may not match. Please ensure your Airtable table has these exact field names: fullName, email, mobileNumber, forwardCalls, personality, userPrompt, attachedFiles');
    }
    
    throw new Error(errorMessage);
  }

  const result = await response.json();
  return result;
}

// Backward compatibility alias
export const savePersonalKendallUser = saveMyKendallUser;
