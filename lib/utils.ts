/**
 * Sanitizes a recordId by removing any query string parameters or invalid characters
 * @param recordId - The recordId value that may contain query strings or invalid characters
 * @returns A clean recordId value, or null if invalid
 */
export function sanitizeRecordId(recordId: string | null | undefined): string | null {
  if (!recordId) {
    return null;
  }

  // Remove any query string parameters (everything after ? or &)
  let cleanId = recordId.split('?')[0].split('&')[0].trim();

  // Remove any whitespace
  cleanId = cleanId.trim();

  // Validate format: should start with "rec" and contain only alphanumeric characters
  // Airtable record IDs typically start with "rec" followed by alphanumeric characters
  if (!cleanId.match(/^rec[a-zA-Z0-9]+$/)) {
    console.warn('[SANITIZE] Invalid recordId format:', cleanId);
    return null;
  }

  return cleanId;
}

