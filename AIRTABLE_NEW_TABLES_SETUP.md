# Airtable Tables Setup for Enhanced Features

This document outlines the new Airtable tables needed for the enhanced features (Phases 2-5).

## Required Environment Variables

Add these to your `.env` file:

```bash
AIRTABLE_USER_PATTERNS_TABLE_ID=tblXXXXXXXXXXXXXX
AIRTABLE_USER_MEMORY_TABLE_ID=tblYYYYYYYYYYYYYY
```

## Table 1: User Patterns

**Table Name**: `User Patterns`  
**Table ID**: Set in `AIRTABLE_USER_PATTERNS_TABLE_ID`

### Fields:

| Field Name | Field Type | Options/Notes |
|------------|------------|---------------|
| `recordId` | Linked record | Link to main Users table |
| `patternType` | Single select | Options: `recurring_call`, `time_based_action`, `preferred_contact`, `behavior`, `preference` |
| `patternData` | Long text | JSON string containing pattern details |
| `confidence` | Number | Decimal between 0-1, default 0.5 |
| `lastObserved` | Date | ISO timestamp format |
| `createdAt` | Date | ISO timestamp format |
| `updatedAt` | Date | ISO timestamp format |

### Field Descriptions:

- **recordId**: Links to the main Users table record
- **patternType**: Type of pattern detected
  - `recurring_call`: User makes calls to same contact regularly
  - `time_based_action`: User performs actions at specific times
  - `preferred_contact`: Frequently contacted person
  - `behavior`: General behavioral pattern
  - `preference`: User preference or setting
- **patternData**: JSON string with structure:
  ```json
  {
    "description": "Calls Sarah every Friday at 5pm",
    "frequency": "weekly",
    "dayOfWeek": 5,
    "timeOfDay": "17:00",
    "contactName": "Sarah",
    "contactPhone": "+1234567890",
    "metadata": {}
  }
  ```
- **confidence**: How confident we are this pattern is accurate (0-1)
- **lastObserved**: When this pattern was last seen
- **createdAt**: When pattern was first detected
- **updatedAt**: Last time pattern was updated

## Table 2: User Memory

**Table Name**: `User Memory`  
**Table ID**: Set in `AIRTABLE_USER_MEMORY_TABLE_ID`

### Fields:

| Field Name | Field Type | Options/Notes |
|------------|------------|---------------|
| `recordId` | Linked record | Link to main Users table |
| `memoryType` | Single select | Options: `fact`, `preference`, `relationship`, `reminder`, `important_date`, `instruction` |
| `key` | Single line text | Unique key for this memory (e.g., "favorite_coffee") |
| `value` | Long text | The actual memory content |
| `context` | Long text | Optional additional context |
| `importance` | Single select | Options: `low`, `medium`, `high` (default: `medium`) |
| `expiresAt` | Date | Optional expiration date (ISO timestamp) |
| `createdAt` | Date | ISO timestamp format |
| `updatedAt` | Date | ISO timestamp format |

### Field Descriptions:

- **recordId**: Links to the main Users table record
- **memoryType**: Type of memory
  - `fact`: Factual information about the user
  - `preference`: User preference or setting
  - `relationship`: Information about relationships
  - `reminder`: Reminder or task
  - `important_date`: Important date or event
  - `instruction`: Instruction from user
- **key**: Unique identifier for this memory (used for upsert logic)
  - Examples: `preferred_call_time`, `best_friend_ali`, `always_confirm_appointments`
- **value**: The actual memory content
  - Examples: "Ryan prefers morning calls", "Ali is best friend, lives in NYC"
- **context**: Optional additional context about this memory
- **importance**: Priority level (affects suggestion ranking)
- **expiresAt**: Optional expiration (memories auto-expire after this date)
- **createdAt**: When memory was created
- **updatedAt**: Last time memory was updated

## Setup Instructions

1. **Create Tables in Airtable**:
   - Create two new tables: "User Patterns" and "User Memory"
   - Set up fields exactly as specified above

2. **Get Table IDs**:
   - Go to https://airtable.com/api
   - Select your base
   - Find the table ID for each new table (starts with `tbl`)
   - Add to `.env` file

3. **Configure Linked Records**:
   - In both tables, configure the `recordId` field to link to your main Users table
   - Set relationship type to "One record from Users table"

4. **Set Field Options**:
   - Configure single select fields with exact options listed above
   - Set default values where specified

5. **Test**:
   - The system will automatically create records when users interact
   - Check that records are being created correctly
   - Verify linked records work properly

## Notes

- Both tables are optional - if not configured, features will gracefully degrade
- The system will log warnings if tables are missing but won't break
- Patterns and memories are created automatically based on user behavior
- Users can also explicitly create memories through chat (e.g., "Remember that...")

## Example Records

### User Pattern Record:
```
recordId: [Link to User record]
patternType: recurring_call
patternData: {"description": "Calls mom every Sunday", "frequency": "weekly", "dayOfWeek": 0, "timeOfDay": "14:00", "contactName": "Mom", "contactPhone": "+1234567890"}
confidence: 0.8
lastObserved: 2025-01-15T14:00:00Z
```

### User Memory Record:
```
recordId: [Link to User record]
memoryType: preference
key: preferred_call_time
value: Ryan prefers morning calls between 9am-12pm
importance: high
```




