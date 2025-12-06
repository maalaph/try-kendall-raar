import {
  __esm,
  __name,
  init_esm
} from "./chunk-HXW2Z2VN.mjs";

// lib/vapiVoices.ts
function getAllVAPIVoices() {
  return vapiVoiceCatalog;
}
function getVAPIVoiceById(id) {
  return vapiVoiceCatalog.find((voice) => voice.id === id || voice.vapiVoiceId === id);
}
function getVAPIVoiceByVapiId(vapiVoiceId) {
  return vapiVoiceCatalog.find((voice) => voice.vapiVoiceId === vapiVoiceId);
}
var vapiVoiceCatalog;
var init_vapiVoices = __esm({
  "lib/vapiVoices.ts"() {
    init_esm();
    vapiVoiceCatalog = [
      // Male voices
      {
        id: "vapi-elliot",
        name: "Elliot",
        vapiVoiceId: "elliot",
        accent: "American",
        gender: "male",
        ageGroup: "middle-aged",
        tags: ["clear", "professional"],
        description: "Elliot - Clear American male voice, professional tone",
        quality: "standard"
      },
      {
        id: "vapi-josh",
        name: "Josh",
        vapiVoiceId: "josh",
        accent: "American",
        gender: "male",
        ageGroup: "young",
        tags: ["bright", "energetic"],
        description: "Josh - Bright American male voice, energetic tone",
        quality: "standard"
      },
      {
        id: "vapi-arnold",
        name: "Arnold",
        vapiVoiceId: "arnold",
        accent: "American",
        gender: "male",
        ageGroup: "older",
        tags: ["deep", "calm"],
        description: "Arnold - Deep American male voice, calm and mature",
        quality: "standard"
      },
      {
        id: "vapi-adam",
        name: "Adam",
        vapiVoiceId: "adam",
        accent: "British",
        gender: "male",
        ageGroup: "middle-aged",
        tags: ["clear", "professional"],
        description: "Adam - Clear British male voice, professional tone",
        quality: "standard"
      },
      {
        id: "vapi-antoni",
        name: "Antoni",
        vapiVoiceId: "antoni",
        accent: "American",
        gender: "male",
        ageGroup: "young",
        tags: ["smooth", "warm"],
        description: "Antoni - Smooth American male voice, warm tone",
        quality: "standard"
      },
      {
        id: "vapi-sam",
        name: "Sam",
        vapiVoiceId: "sam",
        accent: "American",
        gender: "male",
        ageGroup: "middle-aged",
        tags: ["neutral", "clear"],
        description: "Sam - Neutral American male voice, clear pronunciation",
        quality: "standard"
      },
      // Female voices
      {
        id: "vapi-leah",
        name: "Leah",
        vapiVoiceId: "leah",
        accent: "American",
        gender: "female",
        ageGroup: "young",
        tags: ["bright", "clear"],
        description: "Leah - Bright American female voice, clear and energetic",
        quality: "standard"
      },
      {
        id: "vapi-lily",
        name: "Lily",
        vapiVoiceId: "lily",
        accent: "American",
        gender: "female",
        ageGroup: "young",
        tags: ["smooth", "warm"],
        description: "Lily - Smooth American female voice, warm and friendly",
        quality: "standard"
      },
      {
        id: "vapi-domi",
        name: "Domi",
        vapiVoiceId: "domi",
        accent: "American",
        gender: "female",
        ageGroup: "middle-aged",
        tags: ["professional", "clear"],
        description: "Domi - Professional American female voice, clear pronunciation",
        quality: "standard"
      },
      {
        id: "vapi-bella",
        name: "Bella",
        vapiVoiceId: "bella",
        accent: "American",
        gender: "female",
        ageGroup: "young",
        tags: ["energetic", "bright"],
        description: "Bella - Energetic American female voice, bright and lively",
        quality: "standard"
      },
      {
        id: "vapi-dorothy",
        name: "Dorothy",
        vapiVoiceId: "dorothy",
        accent: "American",
        gender: "female",
        ageGroup: "older",
        tags: ["calm", "warm"],
        description: "Dorothy - Calm American female voice, warm and mature",
        quality: "standard"
      },
      {
        id: "vapi-rachel",
        name: "Rachel",
        vapiVoiceId: "rachel",
        accent: "British",
        gender: "female",
        ageGroup: "middle-aged",
        tags: ["professional", "clear"],
        description: "Rachel - Professional British female voice, clear pronunciation",
        quality: "standard"
      },
      {
        id: "vapi-charlotte",
        name: "Charlotte",
        vapiVoiceId: "charlotte",
        accent: "British",
        gender: "female",
        ageGroup: "young",
        tags: ["bright", "energetic"],
        description: "Charlotte - Bright British female voice, energetic tone",
        quality: "standard"
      }
      // Add more voices as needed to reach 30-60 total
      // Focus on variety: different accents, ages, voice characteristics
    ];
    __name(getAllVAPIVoices, "getAllVAPIVoices");
    __name(getVAPIVoiceById, "getVAPIVoiceById");
    __name(getVAPIVoiceByVapiId, "getVAPIVoiceByVapiId");
  }
});
init_vapiVoices();
export {
  getAllVAPIVoices,
  getVAPIVoiceById,
  getVAPIVoiceByVapiId,
  vapiVoiceCatalog
};
//# sourceMappingURL=vapiVoices-QJGUXJSY.mjs.map
