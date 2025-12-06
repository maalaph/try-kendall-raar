import {
  database_exports,
  getChatMessages,
  getUserMemories,
  getUserPatterns,
  init_database,
  upsertUserMemory
} from "./chunk-5RLRGVI6.mjs";
import {
  task
} from "./chunk-CY2WMQQT.mjs";
import {
  __name,
  __toCommonJS,
  init_esm
} from "./chunk-HXW2Z2VN.mjs";

// trigger/learning-loops.ts
init_esm();

// lib/patternExtractor.ts
init_esm();

// lib/userPatterns.ts
init_esm();
var AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
var USER_PATTERNS_TABLE_ID = process.env.AIRTABLE_USER_PATTERNS_TABLE_ID;
var USER_MEMORY_TABLE_ID = process.env.AIRTABLE_USER_MEMORY_TABLE_ID;
var USER_PATTERNS_API_URL = AIRTABLE_BASE_ID && USER_PATTERNS_TABLE_ID ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${USER_PATTERNS_TABLE_ID}` : "";
var USER_MEMORY_API_URL = AIRTABLE_BASE_ID && USER_MEMORY_TABLE_ID ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${USER_MEMORY_TABLE_ID}` : "";
var getHeaders = /* @__PURE__ */ __name(() => ({
  "Authorization": `Bearer ${process.env.AIRTABLE_API_KEY}`,
  "Content-Type": "application/json"
}), "getHeaders");
async function upsertUserPattern(pattern) {
  try {
    if (!USER_PATTERNS_API_URL) {
      console.warn("[USER PATTERNS] USER_PATTERNS_TABLE_ID not configured. Pattern will not be saved.");
      return pattern;
    }
    const fields = {
      recordId: [pattern.recordId],
      // Linked record
      patternType: pattern.patternType,
      patternData: JSON.stringify(pattern.patternData),
      confidence: pattern.confidence || 0.5,
      lastObserved: pattern.lastObserved || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (pattern.createdAt) {
      fields.createdAt = pattern.createdAt;
    } else {
      fields.createdAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    if (pattern.id) {
      const url = `${USER_PATTERNS_API_URL}/${pattern.id}`;
      const response2 = await fetch(url, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ fields })
      });
      if (response2.ok) {
        const result2 = await response2.json();
        return parsePatternFromRecord(result2);
      }
    }
    const response = await fetch(USER_PATTERNS_API_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ fields })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Failed to create pattern: ${response.status}`;
      console.error("[USER PATTERNS] Failed to create pattern:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
        patternType: pattern.patternType,
        recordId: pattern.recordId,
        hasTableId: !!USER_PATTERNS_TABLE_ID,
        tableId: USER_PATTERNS_TABLE_ID
      });
      throw new Error(errorMessage);
    }
    const result = await response.json();
    console.log("[USER PATTERNS] Successfully saved pattern:", {
      patternType: pattern.patternType,
      recordId: pattern.recordId,
      patternId: result.id,
      confidence: pattern.confidence
    });
    return parsePatternFromRecord(result);
  } catch (error) {
    console.error("[USER PATTERNS] Failed to upsert pattern:", error);
    console.error("[USER PATTERNS] Error details:", {
      patternType: pattern.patternType,
      recordId: pattern.recordId,
      hasTableId: !!USER_PATTERNS_TABLE_ID,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
    throw error;
  }
}
__name(upsertUserPattern, "upsertUserPattern");
async function getUserPatterns2(recordId, patternType) {
  try {
    if (!USER_PATTERNS_API_URL) {
      return [];
    }
    let filterFormula = `{recordId} = "${recordId}"`;
    if (patternType) {
      filterFormula += ` AND {patternType} = "${patternType}"`;
    }
    const url = `${USER_PATTERNS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=lastObserved&sort[0][direction]=desc`;
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders()
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[USER PATTERNS] Failed to get patterns:", errorData);
      return [];
    }
    const result = await response.json();
    return (result.records || []).map(parsePatternFromRecord);
  } catch (error) {
    console.error("[USER PATTERNS] Failed to get patterns:", error);
    return [];
  }
}
__name(getUserPatterns2, "getUserPatterns");
function parsePatternFromRecord(record) {
  return {
    id: record.id,
    recordId: Array.isArray(record.fields?.recordId) ? record.fields.recordId[0] : record.fields?.recordId || "",
    patternType: record.fields?.patternType || "behavior",
    patternData: typeof record.fields?.patternData === "string" ? JSON.parse(record.fields.patternData) : record.fields?.patternData || {},
    confidence: record.fields?.confidence || 0.5,
    lastObserved: record.fields?.lastObserved || record.fields?.createdAt,
    createdAt: record.fields?.createdAt,
    updatedAt: record.fields?.updatedAt
  };
}
__name(parsePatternFromRecord, "parsePatternFromRecord");

// lib/patternExtractor.ts
async function extractPatternsFromMessage(recordId, message, role, timestamp, previousMessages) {
  if (role !== "user") return;
  const patterns = [];
  const callPattern = extractRecurringCallPattern(message, previousMessages || []);
  if (callPattern) {
    patterns.push(callPattern);
  }
  const timePattern = extractTimeBasedPattern(message);
  if (timePattern) {
    patterns.push(timePattern);
  }
  const contactPattern = extractContactPattern(message, previousMessages || []);
  if (contactPattern) {
    patterns.push(contactPattern);
  }
  const preferencePattern = extractPreferencePattern(message);
  if (preferencePattern) {
    patterns.push(preferencePattern);
  }
  console.log("[PATTERN EXTRACTION] Extracted", patterns.length, "pattern(s) from message");
  for (const pattern of patterns) {
    try {
      console.log("[PATTERN EXTRACTION] Processing pattern:", {
        type: pattern.patternType,
        confidence: pattern.confidence,
        description: pattern.patternData.description
      });
      const existingPatterns = await getUserPatterns2(recordId, pattern.patternType);
      const similarPattern = existingPatterns.find(
        (p) => JSON.stringify(p.patternData) === JSON.stringify(pattern.patternData)
      );
      if (similarPattern) {
        console.log("[PATTERN EXTRACTION] Updating existing pattern, increasing confidence from", similarPattern.confidence);
        await upsertUserPattern({
          ...similarPattern,
          confidence: Math.min(1, similarPattern.confidence + 0.1),
          // Increase confidence
          lastObserved: timestamp
        });
        console.log("[PATTERN EXTRACTION] Successfully updated pattern");
      } else {
        console.log("[PATTERN EXTRACTION] Creating new pattern");
        await upsertUserPattern({
          recordId,
          patternType: pattern.patternType,
          patternData: pattern.patternData,
          confidence: pattern.confidence,
          lastObserved: timestamp
        });
        console.log("[PATTERN EXTRACTION] Successfully created new pattern");
      }
    } catch (error) {
      console.error("[PATTERN EXTRACTION] Could not save pattern:", error);
      console.error("[PATTERN EXTRACTION] Error details:", {
        patternType: pattern.patternType,
        recordId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : void 0
      });
    }
  }
  if (patterns.length === 0) {
    console.log("[PATTERN EXTRACTION] No patterns detected in message");
  }
}
__name(extractPatternsFromMessage, "extractPatternsFromMessage");
function extractRecurringCallPattern(message, previousMessages) {
  const lowerMessage = message.toLowerCase();
  const callMatches = lowerMessage.match(/(?:call|phone|dial|contact)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (!callMatches) return null;
  const contactName = callMatches[1].trim();
  const dayMatch = lowerMessage.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend)/i);
  const timeMatch = lowerMessage.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i) || lowerMessage.match(/(\d{1,2})\s*(am|pm)/i);
  const recentCallCount = previousMessages.filter(
    (m) => m.role === "user" && m.message.toLowerCase().includes(contactName.toLowerCase())
  ).length;
  if (recentCallCount >= 2) {
    const dayOfWeek = dayMatch ? getDayOfWeek(dayMatch[1]) : void 0;
    const timeOfDay = timeMatch ? extractTime(timeMatch) : void 0;
    return {
      patternType: "recurring_call",
      patternData: {
        description: `Calls ${contactName}${dayOfWeek !== void 0 ? ` on ${getDayName(dayOfWeek)}` : ""}${timeOfDay ? ` at ${timeOfDay}` : ""}`,
        frequency: dayOfWeek !== void 0 ? "weekly" : void 0,
        dayOfWeek,
        timeOfDay,
        contactName,
        metadata: { observedCount: recentCallCount }
      },
      confidence: Math.min(0.8, 0.3 + recentCallCount * 0.1)
    };
  }
  return null;
}
__name(extractRecurringCallPattern, "extractRecurringCallPattern");
function extractTimeBasedPattern(message) {
  const lowerMessage = message.toLowerCase();
  const morningPref = /(morning|before noon|early|9am|10am|11am)/i.test(lowerMessage);
  const afternoonPref = /(afternoon|after noon|2pm|3pm|4pm)/i.test(lowerMessage);
  const eveningPref = /(evening|night|after 5|after 6)/i.test(lowerMessage);
  if (morningPref || afternoonPref || eveningPref) {
    return {
      patternType: "time_based_action",
      patternData: {
        description: `Prefers ${morningPref ? "morning" : afternoonPref ? "afternoon" : "evening"} activities`,
        timeOfDay: morningPref ? "09:00" : afternoonPref ? "14:00" : "18:00"
      },
      confidence: 0.6
    };
  }
  return null;
}
__name(extractTimeBasedPattern, "extractTimeBasedPattern");
function extractContactPattern(message, previousMessages) {
  const lowerMessage = message.toLowerCase();
  const contactMatches = lowerMessage.match(/(?:call|message|contact|reach out to|talk to)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (!contactMatches) return null;
  const contactName = contactMatches[1].trim();
  const mentionCount = previousMessages.filter(
    (m) => m.message.toLowerCase().includes(contactName.toLowerCase())
  ).length;
  if (mentionCount >= 3) {
    return {
      patternType: "preferred_contact",
      patternData: {
        description: `Frequently contacts ${contactName}`,
        contactName,
        metadata: { mentionCount }
      },
      confidence: Math.min(0.9, 0.5 + mentionCount * 0.1)
    };
  }
  return null;
}
__name(extractContactPattern, "extractContactPattern");
function extractPreferencePattern(message) {
  const lowerMessage = message.toLowerCase();
  const preferencePatterns = [
    /(?:i|i'd|i would|i prefer|i like).*?(always|never|prefer|like|don't like)/i,
    /(?:remember|note|important).*?(always|never|prefer)/i
  ];
  for (const pattern of preferencePatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        patternType: "preference",
        patternData: {
          description: message.substring(0, 100),
          // First 100 chars
          metadata: { extracted: true }
        },
        confidence: 0.7
      };
    }
  }
  return null;
}
__name(extractPreferencePattern, "extractPreferencePattern");
function getDayOfWeek(dayName) {
  const days = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  return days[dayName.toLowerCase()] ?? -1;
}
__name(getDayOfWeek, "getDayOfWeek");
function getDayName(day) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[day] || "";
}
__name(getDayName, "getDayName");
function extractTime(match) {
  if (match[3]) {
    let hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    const ampm = match[3]?.toLowerCase() || match[2]?.toLowerCase();
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  } else {
    const hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }
}
__name(extractTime, "extractTime");

// trigger/learning-loops.ts
init_database();
init_database();
var extractPatternsTask = task({
  id: "extract-patterns",
  run: /* @__PURE__ */ __name(async (payload) => {
    try {
      console.log("[TRIGGER] Starting pattern extraction task:", {
        recordId: payload.recordId,
        messageLength: payload.message.length
      });
      await extractPatternsFromMessage(
        payload.recordId,
        payload.message,
        payload.role,
        payload.timestamp,
        payload.previousMessages || []
      );
      console.log("[TRIGGER] Pattern extraction completed successfully");
      return { success: true };
    } catch (error) {
      console.error("[TRIGGER] Pattern extraction failed:", error);
      throw error;
    }
  }, "run")
});
var batchExtractPatternsTask = task({
  id: "batch-extract-patterns",
  run: /* @__PURE__ */ __name(async (payload) => {
    try {
      console.log("[TRIGGER] Starting batch pattern extraction:", {
        recordId: payload.recordId,
        messageCount: payload.messages.length
      });
      const results = [];
      for (const msg of payload.messages) {
        try {
          await extractPatternsFromMessage(
            payload.recordId,
            msg.message,
            msg.role,
            msg.timestamp,
            payload.messages.filter((m) => m.timestamp < msg.timestamp)
          );
          results.push({ success: true, message: msg.message.substring(0, 50) });
        } catch (error) {
          console.error("[TRIGGER] Failed to extract patterns for message:", error);
          results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return { results, total: payload.messages.length, successful: results.filter((r) => r.success).length };
    } catch (error) {
      console.error("[TRIGGER] Batch pattern extraction failed:", error);
      throw error;
    }
  }, "run")
});
var consolidateMemoriesTask = task({
  id: "consolidate-memories",
  run: /* @__PURE__ */ __name(async (payload) => {
    try {
      console.log("[TRIGGER] Starting memory consolidation:", {
        recordId: payload.recordId
      });
      const memories = await getUserMemories(payload.recordId);
      const memoryGroups = /* @__PURE__ */ new Map();
      for (const memory of memories) {
        const baseKey = memory.key.split("_")[0] || memory.key;
        if (!memoryGroups.has(baseKey)) {
          memoryGroups.set(baseKey, []);
        }
        memoryGroups.get(baseKey).push(memory);
      }
      let consolidated = 0;
      for (const [baseKey, group] of memoryGroups.entries()) {
        if (group.length > 1) {
          const primary = group.sort((a, b) => {
            const importanceOrder = { high: 3, medium: 2, low: 1 };
            const aImp = importanceOrder[a.importance || "medium"];
            const bImp = importanceOrder[b.importance || "medium"];
            if (aImp !== bImp) return bImp - aImp;
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          })[0];
          const contexts = group.filter((m) => m.id !== primary.id && m.context).map((m) => m.context).filter(Boolean);
          if (contexts.length > 0) {
            primary.context = [primary.context, ...contexts].filter(Boolean).join("; ");
          }
          await upsertUserMemory(primary);
          consolidated += group.length - 1;
        }
      }
      const now = /* @__PURE__ */ new Date();
      const expired = memories.filter((m) => m.expiresAt && new Date(m.expiresAt) < now);
      console.log(`[TRIGGER] Found ${expired.length} expired memories (cleanup not implemented yet)`);
      console.log("[TRIGGER] Memory consolidation completed:", {
        totalMemories: memories.length,
        consolidated,
        expired: expired.length
      });
      return {
        success: true,
        totalMemories: memories.length,
        consolidated,
        expired: expired.length
      };
    } catch (error) {
      console.error("[TRIGGER] Memory consolidation failed:", error);
      throw error;
    }
  }, "run")
});
var updatePatternConfidenceTask = task({
  id: "update-pattern-confidence",
  run: /* @__PURE__ */ __name(async (payload) => {
    try {
      console.log("[TRIGGER] Starting pattern confidence update:", {
        recordId: payload.recordId
      });
      const patterns = await getUserPatterns(payload.recordId);
      const threadId = await (init_database(), __toCommonJS(database_exports)).getOrCreateThreadId(payload.recordId);
      const recentMessages = await getChatMessages({
        threadId,
        limit: 100
      });
      let updated = 0;
      for (const pattern of patterns) {
        let matches = 0;
        for (const msg of recentMessages.messages) {
          const msgLower = msg.message.toLowerCase();
          const patternDesc = pattern.patternData.description?.toLowerCase() || "";
          if (patternDesc && msgLower.includes(patternDesc.split(" ")[0])) {
            matches++;
          }
        }
        if (matches > 0) {
          const newConfidence = Math.min(1, (pattern.confidence || 0.5) + matches * 0.1);
          if (newConfidence !== pattern.confidence) {
            await (init_database(), __toCommonJS(database_exports)).upsertUserPattern({
              ...pattern,
              confidence: newConfidence,
              lastObserved: (/* @__PURE__ */ new Date()).toISOString()
            });
            updated++;
          }
        } else {
          const newConfidence = Math.max(0.1, (pattern.confidence || 0.5) - 0.05);
          if (newConfidence !== pattern.confidence) {
            await (init_database(), __toCommonJS(database_exports)).upsertUserPattern({
              ...pattern,
              confidence: newConfidence
            });
            updated++;
          }
        }
      }
      console.log("[TRIGGER] Pattern confidence update completed:", {
        totalPatterns: patterns.length,
        updated
      });
      return {
        success: true,
        totalPatterns: patterns.length,
        updated
      };
    } catch (error) {
      console.error("[TRIGGER] Pattern confidence update failed:", error);
      throw error;
    }
  }, "run")
});

export {
  extractPatternsTask,
  batchExtractPatternsTask,
  consolidateMemoriesTask,
  updatePatternConfidenceTask
};
//# sourceMappingURL=chunk-OK4K7FXO.mjs.map
