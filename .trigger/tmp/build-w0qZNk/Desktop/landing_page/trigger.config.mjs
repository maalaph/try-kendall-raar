import {
  init_esm
} from "../../chunk-HXW2Z2VN.mjs";

// trigger.config.ts
init_esm();
var config = {
  project: process.env.TRIGGER_PROJECT_ID || "",
  // Directory where your tasks are located
  dirs: ["./trigger"],
  // Log level for Trigger.dev
  logLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
  // Maximum duration for tasks (required in v4)
  // 5 minutes in seconds
  maxDuration: 300,
  build: {}
};
var resolveEnvVars = void 0;
export {
  config,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
