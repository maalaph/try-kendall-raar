import {
  schedules_exports
} from "./chunk-CY2WMQQT.mjs";
import {
  __name,
  init_esm
} from "./chunk-HXW2Z2VN.mjs";

// trigger/scheduled-tasks.ts
init_esm();
var dailyPatternAnalysis = schedules_exports.create({
  id: "daily-pattern-analysis",
  cron: "0 2 * * *",
  // 2 AM UTC daily
  task: /* @__PURE__ */ __name(async (payload, { ctx }) => {
    console.log("[TRIGGER] Daily pattern analysis started");
    return {
      success: true,
      message: "Daily pattern analysis scheduled (implement user iteration)"
    };
  }, "task")
});
var weeklyMemoryConsolidation = schedules_exports.create({
  id: "weekly-memory-consolidation",
  cron: "0 3 * * 1",
  // 3 AM UTC every Monday
  task: /* @__PURE__ */ __name(async (payload, { ctx }) => {
    console.log("[TRIGGER] Weekly memory consolidation started");
    return {
      success: true,
      message: "Weekly memory consolidation scheduled (implement user iteration)"
    };
  }, "task")
});
var periodicEmbeddingBackfill = schedules_exports.create({
  id: "periodic-embedding-backfill",
  cron: "0 4 * * 0",
  // 4 AM UTC every Sunday
  task: /* @__PURE__ */ __name(async (payload, { ctx }) => {
    console.log("[TRIGGER] Periodic embedding backfill started");
    return {
      success: true,
      message: "Periodic embedding backfill scheduled (implement user iteration)"
    };
  }, "task")
});

export {
  dailyPatternAnalysis,
  weeklyMemoryConsolidation,
  periodicEmbeddingBackfill
};
//# sourceMappingURL=chunk-6XT7NOOF.mjs.map
