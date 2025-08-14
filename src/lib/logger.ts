// src/utils/logger.ts
export function createLogger(env: { LOG_LEVEL?: string }, requestId?: string) {
  // Internal type — not exported
  type LogLevel = "debug" | "info" | "warn" | "error" | "none";

  const levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4,
  };

  // Parse and normalize level, fallback for local dev
  const currentLevel: LogLevel =
    (env.LOG_LEVEL?.toLowerCase() as LogLevel) || "info";

  const log = (level: LogLevel, ...args: unknown[]) => {
    if (levelOrder[level] < levelOrder[currentLevel]) return;

    const ts = new Date().toISOString();
    const output = {
      ts,
      level,
      requestId,
      msg: args.map(a =>
        typeof a === "object" ? a : String(a)
      ),
    };

    // Use console.log for debug to ensure Wrangler prints it
    const method = level === "debug" ? "log" : level;
    console[method](JSON.stringify(output));
  };

  return {
    debug: (...args: unknown[]) => log("debug", ...args),
    info:  (...args: unknown[]) => log("info",  ...args),
    warn:  (...args: unknown[]) => log("warn",  ...args),
    error: (...args: unknown[]) => log("error", ...args),
  };
}
