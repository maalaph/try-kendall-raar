import {
  __esm,
  __name,
  init_esm
} from "./chunk-HXW2Z2VN.mjs";

// lib/vapiElevenLabsVoices.ts
import * as fs from "fs";
import * as path from "path";
function loadVAPIElevenLabsVoices() {
  try {
    const filePath = path.resolve(process.cwd(), "lib", "vapiElevenLabsVoices.json");
    const fileContents = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContents);
    return data;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.warn('[VAPI VOICES] vapiElevenLabsVoices.json not found. Run "npm run fetch-vapi-voices" to generate it.');
      return null;
    }
    console.error("[VAPI VOICES] Error loading voices:", error);
    return null;
  }
}
function getAllVAPIElevenLabsVoices() {
  const data = loadVAPIElevenLabsVoices();
  return data?.voices || [];
}
function getVAPIElevenLabsVoiceById(voiceId) {
  const voices = getAllVAPIElevenLabsVoices();
  return voices.find((voice) => voice.voiceId === voiceId);
}
function getVAPIElevenLabsVoiceByName(name) {
  const voices = getAllVAPIElevenLabsVoices();
  const lowerName = name.toLowerCase();
  return voices.find((voice) => voice.name.toLowerCase() === lowerName);
}
function getVAPIElevenLabsVoicesMetadata() {
  const data = loadVAPIElevenLabsVoices();
  return data?.metadata || null;
}
function isVAPIVerifiedVoice(voiceId) {
  return getVAPIElevenLabsVoiceById(voiceId) !== void 0;
}
var init_vapiElevenLabsVoices = __esm({
  "lib/vapiElevenLabsVoices.ts"() {
    init_esm();
    __name(loadVAPIElevenLabsVoices, "loadVAPIElevenLabsVoices");
    __name(getAllVAPIElevenLabsVoices, "getAllVAPIElevenLabsVoices");
    __name(getVAPIElevenLabsVoiceById, "getVAPIElevenLabsVoiceById");
    __name(getVAPIElevenLabsVoiceByName, "getVAPIElevenLabsVoiceByName");
    __name(getVAPIElevenLabsVoicesMetadata, "getVAPIElevenLabsVoicesMetadata");
    __name(isVAPIVerifiedVoice, "isVAPIVerifiedVoice");
  }
});
init_vapiElevenLabsVoices();
export {
  getAllVAPIElevenLabsVoices,
  getVAPIElevenLabsVoiceById,
  getVAPIElevenLabsVoiceByName,
  getVAPIElevenLabsVoicesMetadata,
  isVAPIVerifiedVoice,
  loadVAPIElevenLabsVoices
};
//# sourceMappingURL=vapiElevenLabsVoices-O366MS6S.mjs.map
