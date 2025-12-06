import type { TriggerConfig } from "@trigger.dev/sdk/v3";

export const config: TriggerConfig = {
  project: process.env.TRIGGER_PROJECT_ID || "",
  // Directory where your tasks are located
  dirs: ["./trigger"],
  // Log level for Trigger.dev
  logLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
  // Maximum duration for tasks (required in v4)
  maxDuration: 300, // 5 minutes in seconds
};

