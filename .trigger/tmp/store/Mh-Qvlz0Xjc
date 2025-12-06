import {
  getElevenLabsMapping,
  init_voiceMapping
} from "./chunk-OP6AZBK3.mjs";
import {
  __esm,
  __name,
  init_esm
} from "./chunk-HXW2Z2VN.mjs";

// lib/voiceLibrary.ts
function curateDiverseVoices(voices, maxVoices = 500) {
  const uniqueVoicesMap = /* @__PURE__ */ new Map();
  for (const voice of voices) {
    const voiceId = voice.voice_id || voice.id || voice.voiceId;
    if (voiceId) {
      const normalizedId = String(voiceId).trim();
      if (normalizedId && !uniqueVoicesMap.has(normalizedId)) {
        uniqueVoicesMap.set(normalizedId, voice);
      }
    }
  }
  const deduplicatedVoices = Array.from(uniqueVoicesMap.values());
  if (deduplicatedVoices.length !== voices.length) {
    console.log(`[VOICE CURATION] Removed ${voices.length - deduplicatedVoices.length} duplicate voices`);
  }
  if (deduplicatedVoices.length <= maxVoices) {
    return deduplicatedVoices;
  }
  console.log(`[VOICE CURATION] Curating ${maxVoices} diverse voices from ${deduplicatedVoices.length} unique voices...`);
  const byGender = { male: [], female: [], neutral: [] };
  const byAccent = {};
  const byAge = { young: [], "middle-aged": [], older: [] };
  for (const voice of deduplicatedVoices) {
    const gender = (voice.labels?.gender || "neutral").toLowerCase();
    const accent = voice.labels?.accent || "American";
    const age = voice.labels?.age || "";
    if (gender === "male") byGender.male.push(voice);
    else if (gender === "female") byGender.female.push(voice);
    else byGender.neutral.push(voice);
    if (!byAccent[accent]) byAccent[accent] = [];
    byAccent[accent].push(voice);
    if (age.includes("young")) byAge.young.push(voice);
    else if (age.includes("old") || age.includes("elder")) byAge.older.push(voice);
    else byAge["middle-aged"].push(voice);
  }
  const curated = [];
  const used = /* @__PURE__ */ new Set();
  const targetPerGender = Math.floor(maxVoices / 3);
  const targetPerAge = Math.floor(maxVoices / 3);
  for (const gender of ["male", "female", "neutral"]) {
    const available = byGender[gender].filter((v) => !used.has(v.voice_id));
    const take = Math.min(targetPerGender, available.length);
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, take);
    selected.forEach((v) => {
      curated.push(v);
      used.add(v.voice_id);
    });
  }
  for (const age of ["young", "middle-aged", "older"]) {
    const available = byAge[age].filter((v) => !used.has(v.voice_id));
    const take = Math.min(targetPerAge, available.length);
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, take);
    selected.forEach((v) => {
      if (!used.has(v.voice_id)) {
        curated.push(v);
        used.add(v.voice_id);
      }
    });
  }
  const accents = Object.keys(byAccent).sort();
  const remainingSlots = maxVoices - curated.length;
  const perAccent = Math.max(2, Math.floor(remainingSlots / Math.max(1, accents.length)));
  for (const accent of accents) {
    const available = byAccent[accent].filter((v) => !used.has(v.voice_id));
    if (available.length > 0 && curated.length < maxVoices) {
      const take = Math.min(perAccent, available.length, maxVoices - curated.length);
      const shuffled = available.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, take);
      selected.forEach((v) => {
        if (!used.has(v.voice_id) && curated.length < maxVoices) {
          curated.push(v);
          used.add(v.voice_id);
        }
      });
    }
  }
  const remaining = maxVoices - curated.length;
  if (remaining > 0) {
    const available = deduplicatedVoices.filter((v) => !used.has(v.voice_id));
    const shuffled = available.sort(() => Math.random() - 0.5);
    const random = shuffled.slice(0, remaining);
    random.forEach((v) => {
      if (!used.has(v.voice_id)) {
        curated.push(v);
        used.add(v.voice_id);
      }
    });
  }
  const finalMap = /* @__PURE__ */ new Map();
  for (const voice of curated) {
    const voiceId = voice.voice_id || voice.id || voice.voiceId;
    if (voiceId) {
      const normalizedId = String(voiceId).trim();
      if (normalizedId && !finalMap.has(normalizedId)) {
        finalMap.set(normalizedId, voice);
      }
    }
  }
  const final = Array.from(finalMap.values()).sort(() => Math.random() - 0.5).slice(0, maxVoices);
  if (final.length !== curated.length) {
    console.log(`[VOICE CURATION] Removed ${curated.length - final.length} duplicate voices from final set`);
  }
  const finalByGender = { male: 0, female: 0, neutral: 0 };
  const finalByAccent = {};
  const finalByAge = { young: 0, "middle-aged": 0, older: 0 };
  for (const voice of final) {
    const gender = (voice.labels?.gender || "neutral").toLowerCase();
    const accent = voice.labels?.accent || "American";
    const age = voice.labels?.age || "";
    if (gender === "male") finalByGender.male++;
    else if (gender === "female") finalByGender.female++;
    else finalByGender.neutral++;
    finalByAccent[accent] = (finalByAccent[accent] || 0) + 1;
    if (age.includes("young")) finalByAge.young++;
    else if (age.includes("old") || age.includes("elder")) finalByAge.older++;
    else finalByAge["middle-aged"]++;
  }
  console.log(`[VOICE CURATION] Curated ${final.length} voices with diversity:`);
  console.log(`[VOICE CURATION] - Gender: ${finalByGender.male} male, ${finalByGender.female} female, ${finalByGender.neutral} neutral`);
  console.log(`[VOICE CURATION] - Age: ${finalByAge.young} young, ${finalByAge["middle-aged"]} middle-aged, ${finalByAge.older} older`);
  console.log(`[VOICE CURATION] - Accents: ${Object.keys(finalByAccent).length} different accents`);
  return final;
}
async function initializeVoiceLibrary() {
  const { getAllVAPIVoices } = await import("./vapiVoices-QJGUXJSY.mjs");
  const vapiVoices = getAllVAPIVoices();
  const vapiCuratedVoices = vapiVoices.map((vapiVoice) => ({
    id: vapiVoice.id,
    name: vapiVoice.name,
    vapiVoiceId: vapiVoice.vapiVoiceId,
    source: "vapi",
    tags: vapiVoice.tags,
    accent: vapiVoice.accent,
    gender: vapiVoice.gender,
    ageGroup: vapiVoice.ageGroup,
    tone: vapiVoice.tags,
    // Use tags as tone for VAPI voices
    description: vapiVoice.description,
    useCases: ["general"],
    languages: ["en", "es", "ar", "fr", "de", "it", "pt", "zh", "ja", "ko", "hi", "nl", "pl", "ru", "tr"],
    quality: "standard"
    // VAPI voices are standard quality
  }));
  let verifiedElevenLabsVoiceIds = /* @__PURE__ */ new Set();
  try {
    const { getAllVAPIElevenLabsVoices } = await import("./vapiElevenLabsVoices-O366MS6S.mjs");
    const verifiedVoices = getAllVAPIElevenLabsVoices();
    verifiedElevenLabsVoiceIds = new Set(verifiedVoices.map((v) => v.voiceId));
    console.log(`[VOICE LIBRARY] Loaded ${verifiedVoices.length} VAPI-verified ElevenLabs voices from vapiElevenLabsVoices.json`);
  } catch (error) {
    console.warn('[VOICE LIBRARY] Could not load VAPI-verified ElevenLabs voices. Run "npm run fetch-vapi-voices" to generate the file.');
    console.warn("[VOICE LIBRARY] Will include all ElevenLabs voices (not filtered to VAPI-verified only)");
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("[VOICE LIBRARY] ELEVENLABS_API_KEY not found, using empty library");
    return [];
  }
  try {
    let allElevenLabsVoices = [];
    let verifiedVoicesFound = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;
    const MIN_VERIFIED_VOICES = 1500;
    const MAX_PAGES = 100;
    console.log("[VOICE LIBRARY] Fetching voices from ElevenLabs (will continue until we have enough verified voices)...");
    while (hasMore && page <= MAX_PAGES) {
      const response = await fetch(`https://api.elevenlabs.io/v1/voices?page=${page}&page_size=${pageSize}`, {
        headers: { "xi-api-key": apiKey }
      });
      if (!response.ok) {
        if (page === 1) {
          console.error("[VOICE LIBRARY] Failed to fetch voices from ElevenLabs");
          return [];
        } else {
          console.log(`[VOICE LIBRARY] Reached end of pagination at page ${page}`);
          break;
        }
      }
      const data = await response.json();
      const voices = data.voices || [];
      if (voices.length === 0) {
        hasMore = false;
      } else {
        allElevenLabsVoices.push(...voices);
        if (verifiedElevenLabsVoiceIds.size > 0) {
          const verifiedInPage = voices.filter((voice) => verifiedElevenLabsVoiceIds.has(voice.voice_id));
          verifiedVoicesFound.push(...verifiedInPage);
        } else {
          verifiedVoicesFound.push(...voices);
        }
        console.log(`[VOICE LIBRARY] Page ${page}: ${voices.length} voices (${verifiedVoicesFound.length} verified so far)`);
        if (verifiedVoicesFound.length >= MIN_VERIFIED_VOICES && page >= 10) {
          console.log(`[VOICE LIBRARY] Reached target of ${MIN_VERIFIED_VOICES} verified voices after ${page} pages. Stopping fetch.`);
          hasMore = false;
          break;
        }
        if (data.has_more === false || voices.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }
    console.log(`[VOICE LIBRARY] Total voices fetched from ElevenLabs: ${allElevenLabsVoices.length}`);
    console.log(`[VOICE LIBRARY] Total verified voices found: ${verifiedVoicesFound.length}`);
    const voicesToProcess = verifiedElevenLabsVoiceIds.size > 0 ? verifiedVoicesFound : allElevenLabsVoices;
    if (verifiedElevenLabsVoiceIds.size > 0) {
      console.log(`[VOICE LIBRARY] Using ${voicesToProcess.length} VAPI-verified ElevenLabs voices (fetched ${allElevenLabsVoices.length} total)`);
    } else {
      console.log(`[VOICE LIBRARY] Using ${voicesToProcess.length} voices (no verification list - all voices)`);
    }
    const MAX_VOICES = 500;
    const curatedVoices = curateDiverseVoices(voicesToProcess, MAX_VOICES);
    console.log(`[VOICE LIBRARY] Curated ${curatedVoices.length} diverse voices from ${voicesToProcess.length} verified voices`);
    const curatedVoicesFiltered = curatedVoices.filter((voice) => {
      const voiceId = voice.voice_id || voice.id || voice.voiceId;
      return voiceId ? !UNSUPPORTED_ELEVENLABS_VOICE_IDS.has(String(voiceId).trim()) : true;
    });
    if (curatedVoicesFiltered.length !== curatedVoices.length) {
      console.log(
        `[VOICE LIBRARY] Removed ${curatedVoices.length - curatedVoicesFiltered.length} unsupported ElevenLabs voices (Vapi rejects these IDs)`
      );
    }
    const mappedVoices = curatedVoicesFiltered.map((voice) => {
      const gender = (voice.labels?.gender || "").toLowerCase();
      const accent = voice.labels?.accent || "";
      const age = voice.labels?.age || "";
      let ageGroup = "middle-aged";
      if (age.includes("young")) ageGroup = "young";
      else if (age.includes("old") || age.includes("elder")) ageGroup = "older";
      if (!age || age.trim() === "") {
        const descLower2 = (voice.description || "").toLowerCase();
        const nameLower2 = (voice.name || "").toLowerCase();
        if (descLower2.includes("gen z") || descLower2.includes("genz") || descLower2.includes("20s") || descLower2.includes("20's") || descLower2.includes("teen") || descLower2.includes("teenager") || descLower2.includes("youth") || descLower2.includes("young") || descLower2.includes("college") || descLower2.includes("student")) {
          ageGroup = "young";
        } else if (descLower2.includes("millennial") || descLower2.includes("gen y") || descLower2.includes("30s") || descLower2.includes("30's") || descLower2.includes("40s") || descLower2.includes("40's") || descLower2.includes("middle-aged") || descLower2.includes("middle age")) {
          ageGroup = "middle-aged";
        } else if (descLower2.includes("boomer") || descLower2.includes("gen x") || descLower2.includes("50s") || descLower2.includes("50's") || descLower2.includes("60s") || descLower2.includes("60's") || descLower2.includes("70s") || descLower2.includes("70's") || descLower2.includes("older") || descLower2.includes("old") || descLower2.includes("elder") || descLower2.includes("senior") || descLower2.includes("aged") || descLower2.includes("elderly") || descLower2.includes("grandpa") || descLower2.includes("grandma")) {
          ageGroup = "older";
        } else if (nameLower2.includes("young") || nameLower2.includes("teen") || nameLower2.includes("youth")) {
          ageGroup = "young";
        } else if (nameLower2.includes("old") || nameLower2.includes("elder") || nameLower2.includes("senior") || nameLower2.includes("grandpa") || nameLower2.includes("grandma")) {
          ageGroup = "older";
        }
      }
      const nameLower = (voice.name || "").toLowerCase();
      const descLower = (voice.description || "").toLowerCase();
      const fullText = `${nameLower} ${descLower}`;
      const tags = [];
      const tone = [];
      const useCases = [];
      if (fullText.includes("deep") || fullText.includes("low-pitched") || fullText.includes("bass") || fullText.includes("baritone")) tags.push("deep");
      if (fullText.includes("raspy") || fullText.includes("rough") || fullText.includes("gravelly") || fullText.includes("hoarse") || fullText.includes("husky") || fullText.includes("gritty")) tags.push("raspy");
      if (fullText.includes("calm") || fullText.includes("relaxed") || fullText.includes("soothing") || fullText.includes("serene")) tags.push("calm");
      if (fullText.includes("warm") || fullText.includes("mellow") || fullText.includes("rich")) tags.push("warm");
      if (fullText.includes("smooth") || fullText.includes("clear") || fullText.includes("crisp") || fullText.includes("clean")) tags.push("smooth");
      if (fullText.includes("bright") || fullText.includes("energetic") || fullText.includes("cheerful") || fullText.includes("lively")) tags.push("bright");
      if (fullText.includes("smoker") || fullText.includes("smoker's") || fullText.includes("smoking")) tags.push("smoker");
      if (fullText.includes("soft") || fullText.includes("gentle")) tags.push("soft");
      if (fullText.includes("powerful") || fullText.includes("strong") || fullText.includes("resonant")) tags.push("powerful");
      if (fullText.includes("professional") || fullText.includes("business") || fullText.includes("corporate") || fullText.includes("polished")) tone.push("professional");
      if (fullText.includes("friendly") || fullText.includes("warm") || fullText.includes("welcoming") || fullText.includes("kind")) tone.push("friendly");
      if (fullText.includes("confident") || fullText.includes("authoritative") || fullText.includes("assured") || fullText.includes("decisive")) tone.push("confident");
      if (fullText.includes("energetic") || fullText.includes("lively") || fullText.includes("animated") || fullText.includes("vibrant") || fullText.includes("enthusiastic")) tone.push("energetic");
      if (fullText.includes("calm") || fullText.includes("peaceful") || fullText.includes("serene") || fullText.includes("soothing") || fullText.includes("relaxed")) tone.push("calm");
      if (fullText.includes("sassy") || fullText.includes("bold") || fullText.includes("feisty") || fullText.includes("spirited")) tone.push("sassy");
      if (fullText.includes("witty") || fullText.includes("clever") || fullText.includes("humorous") || fullText.includes("sharp")) tone.push("witty");
      if (fullText.includes("smooth") || fullText.includes("mellow")) tone.push("smooth");
      if (fullText.includes("bright") || fullText.includes("cheerful")) tone.push("bright");
      if (fullText.includes("gay") || fullText.includes("queer") || fullText.includes("lgbtq") || fullText.includes("homosexual") || fullText.includes("lesbian")) {
        tags.push("lgbtq");
      }
      const characterPattern = /\b(bodybuilder|meathead|detective|sherlock|spy|agent|hero|villain|wizard|warrior|knight|pirate|ninja|rapper|singer|artist|musician|jazz\s+musician|narrator|announcer|host|podcaster|teacher|professor|doctor|nurse|lawyer|judge|attorney|soldier|military|veteran|coach|trainer|instructor)\b/i;
      const characterMatch = fullText.match(characterPattern);
      if (characterMatch) {
        let character = characterMatch[0].toLowerCase();
        if (character.includes("jazz") && character.includes("musician")) {
          character = "musician";
        }
        tags.push(character);
      }
      if (fullText.includes("radio") || fullText.includes("host") || fullText.includes("broadcast")) {
        tags.push("radio");
        useCases.push("radio host");
      }
      if (fullText.includes("podcast") || fullText.includes("podcasting")) {
        useCases.push("podcast");
        if (!tags.includes("podcaster")) tags.push("podcaster");
      }
      if (fullText.includes("narration") || fullText.includes("narrator") || fullText.includes("audiobook")) {
        useCases.push("narration");
        if (!tags.includes("narrator")) tags.push("narrator");
      }
      if (fullText.includes("conversational") || fullText.includes("conversation")) {
        useCases.push("conversational");
      }
      if (fullText.includes("music") || fullText.includes("musician") || fullText.includes("jazz")) {
        if (!tags.includes("musician")) tags.push("musician");
        useCases.push("music");
      }
      const fullDescription = voice.description ? `${voice.name} ${voice.description}`.trim() : `${voice.name} - ${accent ? accent + " " : ""}${gender} voice`;
      return {
        id: `KM-${voice.voice_id.substring(0, 6).toUpperCase()}`,
        name: voice.name || "Unknown Voice",
        elevenLabsVoiceId: voice.voice_id,
        source: "elevenlabs",
        tags: tags.length > 0 ? tags : ["general"],
        accent: accent || "American",
        gender: gender === "male" ? "male" : gender === "female" ? "female" : "neutral",
        ageGroup,
        tone: tone.length > 0 ? tone : ["neutral"],
        description: fullDescription,
        // Use full description for comprehensive matching
        useCases: useCases.length > 0 ? useCases : ["general"],
        languages: ["en", "es", "ar", "fr", "de", "it", "pt", "zh", "ja", "ko", "hi", "nl", "pl", "ru", "tr"],
        // All languages supported
        quality: "high"
        // ElevenLabs voices are high quality
      };
    });
    const allVoices = [...mappedVoices, ...vapiCuratedVoices];
    const uniqueVoicesMap = /* @__PURE__ */ new Map();
    for (const voice of allVoices) {
      const voiceId = voice.elevenLabsVoiceId || voice.vapiVoiceId || voice.id;
      if (voiceId && !uniqueVoicesMap.has(voiceId)) {
        uniqueVoicesMap.set(voiceId, voice);
      }
    }
    const deduplicatedVoices = Array.from(uniqueVoicesMap.values());
    if (deduplicatedVoices.length !== allVoices.length) {
      console.log(`[VOICE LIBRARY] Removed ${allVoices.length - deduplicatedVoices.length} duplicate voices before validation`);
    }
    const { validVoices, removedVoices } = await validateVoicesAgainstElevenLabs(deduplicatedVoices);
    const finalUniqueMap = /* @__PURE__ */ new Map();
    for (const voice of validVoices) {
      const voiceId = voice.elevenLabsVoiceId || voice.vapiVoiceId || voice.id;
      if (voiceId && !finalUniqueMap.has(voiceId)) {
        finalUniqueMap.set(voiceId, voice);
      }
    }
    const finalUniqueVoices = Array.from(finalUniqueMap.values());
    if (finalUniqueVoices.length !== validVoices.length) {
      console.log(`[VOICE LIBRARY] Removed ${validVoices.length - finalUniqueVoices.length} duplicate voices after validation`);
    }
    curatedVoiceLibrary.length = 0;
    curatedVoiceLibrary.push(...finalUniqueVoices);
    const validElevenLabsVoices = validVoices.filter((v) => v.source === "elevenlabs");
    const elevenLabsCount = validElevenLabsVoices.length;
    const vapiCount = validVoices.filter((v) => v.source === "vapi").length;
    const totalCount = curatedVoiceLibrary.length;
    const voicesWithTone = validElevenLabsVoices.filter((v) => v.tone && v.tone.length > 0 && v.tone[0] !== "neutral").length;
    console.log(`[VOICE LIBRARY] Initialized with ${elevenLabsCount} ElevenLabs voices and ${vapiCount} VAPI voices (total: ${totalCount})`);
    if (removedVoices.length > 0) {
      console.warn(`[VOICE LIBRARY] Removed ${removedVoices.length} invalid voice(s) during initialization`);
    }
    console.log(`[VOICE LIBRARY] Quality distribution: ${elevenLabsCount} high-quality (ElevenLabs), ${vapiCount} standard (VAPI)`);
    console.log(`[VOICE LIBRARY] Voices with personality/tone descriptors: ${voicesWithTone} out of ${elevenLabsCount} ElevenLabs voices`);
    if (elevenLabsCount < 100) {
      console.warn(`[VOICE LIBRARY] Warning: Only ${elevenLabsCount} ElevenLabs voices loaded. Expected ~140 voices.`);
    } else {
      console.log(`[VOICE LIBRARY] ✓ Successfully loaded ${elevenLabsCount} validated ElevenLabs voices`);
    }
    return curatedVoiceLibrary;
  } catch (error) {
    console.error("[VOICE LIBRARY] Error initializing library:", error);
    return [];
  }
}
async function validateVoicesAgainstElevenLabs(voices) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("[VOICE VALIDATION] ELEVENLABS_API_KEY not found, skipping validation");
    return { validVoices: voices, removedVoices: [] };
  }
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey }
    });
    if (!response.ok) {
      console.warn("[VOICE VALIDATION] Failed to fetch voices from ElevenLabs, skipping validation");
      return { validVoices: voices, removedVoices: [] };
    }
    const data = await response.json();
    const elevenLabsVoices = data.voices || [];
    const validVoiceIds = new Set(
      elevenLabsVoices.map((v) => v.voice_id)
    );
    const elevenLabsVoicesToValidate = voices.filter((v) => v.source === "elevenlabs" && v.elevenLabsVoiceId);
    const vapiVoices = voices.filter((v) => v.source === "vapi");
    const validElevenLabsVoices = [];
    const removedVoices = [];
    for (const voice of elevenLabsVoicesToValidate) {
      if (voice.elevenLabsVoiceId && validVoiceIds.has(voice.elevenLabsVoiceId)) {
        validElevenLabsVoices.push(voice);
      } else {
        removedVoices.push(`${voice.name} (${voice.id})`);
        console.warn(`[VOICE VALIDATION] Removed voice: ${voice.name} (ID: ${voice.elevenLabsVoiceId || "missing"}) - not found in ElevenLabs`);
      }
    }
    const validVoices = [...validElevenLabsVoices, ...vapiVoices];
    if (removedVoices.length > 0) {
      console.log(`[VOICE VALIDATION] Removed ${removedVoices.length} invalid voice(s) from library`);
    } else {
      console.log(`[VOICE VALIDATION] All ${validElevenLabsVoices.length} ElevenLabs voices are valid`);
    }
    return { validVoices, removedVoices };
  } catch (error) {
    console.error("[VOICE VALIDATION] Error validating voices:", error);
    return { validVoices: voices, removedVoices: [] };
  }
}
function getAllCuratedVoices() {
  return curatedVoiceLibrary;
}
function getCuratedVoiceById(id) {
  return curatedVoiceLibrary.find((voice) => voice.id === id);
}
var curatedVoiceLibrary, UNSUPPORTED_ELEVENLABS_VOICE_IDS;
var init_voiceLibrary = __esm({
  "lib/voiceLibrary.ts"() {
    "use strict";
    init_esm();
    curatedVoiceLibrary = [
      // These will be populated by fetching from ElevenLabs API
      // For now, this is a placeholder structure
    ];
    UNSUPPORTED_ELEVENLABS_VOICE_IDS = /* @__PURE__ */ new Set([
      "0FLxgjNYHJnHnNQ3nwk8",
      "0mDYz2rpzUksQMbNcdCc",
      "1a0nAYA3FcNQcMMfbddY",
      "8WRfTpaUoqZSfTerOXzI",
      "DQLhorDHb2d4HkZj4kFd",
      "GoGUcAZovo4MFeLxJdZd",
      "GsfuR3Wo2BACoxELWyEF",
      "Gsndh0O5AnuI2Hj3YUlA",
      "KEVRa7mtDwmBo6pi4ItL",
      "KleDBQ7etYG6NMjnQ9Jw",
      "L5zW3PqYZoWAeS4J1qMV",
      "LeKjR2H906hH45YTS8O5",
      "M5t0724ORuAGCh3p3DUR",
      "MKlLqCItoCkvdhrxgtLv",
      "QF9HJC7XWnue5c9W3LkY",
      "RO2BvjCY3XHTRsIYByXn",
      "Sq93GQT4X1lKDXsQcixO",
      "U0W3edavfdI8ibPeeteQ",
      "Wz5VyMwarjxJoceKovDZ",
      "XagEPz76kWQQ0RWKvQAf",
      "XjdmlV0OFXfXE6Mg2Sb7",
      "XsmrVB66q3D4TaXVaWNF",
      "cgLpYGyXZhkyalKZ0xeZ",
      "dOZwtV72qwiKnZGSlLsC",
      "dOdGri2hgsKdUEaU09Ct",
      "eZm9vdjYgL9PZKtf7XMM",
      "ee2pDOfqzj2pBerZvUCH",
      "efGTHf4ukBiG4n8lptfp",
      "m3yAHyFEFKtbCIM5n7GF",
      "mEHuKdn0uRQSMynXjRNO",
      "nTMUXLFSfbWmdKKy7nDC",
      "nlyULslzTRhqlyv46oPj",
      "nzeAacJi50IvxcyDnMXa",
      "ocZQ262SsZb9RIxcQBOj",
      "u0REnIJvUgcGQYW2Ux8K",
      "wFOtYWBAKv6z33WjceQa",
      "wNl2YBRc8v5uIcq6gOxd",
      "xYWUvKNK6zWCgsdAK7Wi",
      "zYcjlYFOd3taleS0gkk3",
      "zZeq6FndupLBP33ngh9e",
      "zhqwEJnIn9nJv0L8nUkS",
      "ztnpYzQJyWffPj1VC5Uw"
    ]);
    __name(curateDiverseVoices, "curateDiverseVoices");
    __name(initializeVoiceLibrary, "initializeVoiceLibrary");
    __name(validateVoicesAgainstElevenLabs, "validateVoicesAgainstElevenLabs");
    __name(getAllCuratedVoices, "getAllCuratedVoices");
    __name(getCuratedVoiceById, "getCuratedVoiceById");
  }
});

// lib/voiceConfigHelper.ts
async function getVoiceConfigForVAPI(voiceChoice) {
  if (!voiceChoice || typeof voiceChoice !== "string" || !voiceChoice.trim()) {
    return void 0;
  }
  const trimmedChoice = voiceChoice.trim();
  let curatedVoices = getAllCuratedVoices();
  if (curatedVoices.length === 0) {
    curatedVoices = await initializeVoiceLibrary();
  }
  const curatedVoice = getCuratedVoiceById(trimmedChoice);
  if (curatedVoice) {
    if (curatedVoice.source === "elevenlabs" && curatedVoice.elevenLabsVoiceId) {
      return {
        provider: "11labs",
        voiceId: curatedVoice.elevenLabsVoiceId
      };
    } else if (curatedVoice.source === "vapi" && curatedVoice.vapiVoiceId) {
      return {
        provider: "vapi",
        voiceId: curatedVoice.vapiVoiceId
      };
    }
  }
  const mapping = getElevenLabsMapping(trimmedChoice);
  if (mapping?.elevenLabsVoiceId) {
    return {
      provider: "11labs",
      voiceId: mapping.elevenLabsVoiceId
    };
  }
  const isElevenLabsId = trimmedChoice.length >= 15 && trimmedChoice.length <= 25 && /^[a-zA-Z0-9]+$/.test(trimmedChoice) && !trimmedChoice.includes("-") && !trimmedChoice.includes(" ");
  if (isElevenLabsId) {
    return {
      provider: "11labs",
      voiceId: trimmedChoice
    };
  }
  if (trimmedChoice.length > 0 && !trimmedChoice.includes("-")) {
    return {
      provider: "vapi",
      voiceId: trimmedChoice
    };
  }
  console.warn("[VOICE CONFIG] Unknown voice choice format:", trimmedChoice);
  return void 0;
}
var init_voiceConfigHelper = __esm({
  "lib/voiceConfigHelper.ts"() {
    init_esm();
    init_voiceMapping();
    init_voiceLibrary();
    __name(getVoiceConfigForVAPI, "getVoiceConfigForVAPI");
  }
});
init_voiceConfigHelper();
export {
  getVoiceConfigForVAPI
};
//# sourceMappingURL=voiceConfigHelper-PPHKXL3L.mjs.map
