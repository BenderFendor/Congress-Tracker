// Structured logging for the Congress Tracker frontend.
// Mirrors the backend's tracing crate pattern with component-scoped
// loggers, log levels, and a JSON-structured transport.
//
// Usage:
//   import { createLogger } from "@/lib/tracing";
//   const log = createLogger("PortfolioPage");
//   log.info("Data loaded", { trades: 45 });
//   log.error("API failed", { endpoint: "/api/trades", status: 500 });

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[currentLevel];
}

function emit(entry: LogEntry): void {
  const { level, message, component } = entry;

  // Always emit to console with appropriate method
  switch (level) {
    case "debug":
      console.debug(`[${component}] ${message}`, entry);
      break;
    case "info":
      console.info(`[${component}] ${message}`, entry);
      break;
    case "warn":
      console.warn(`[${component}] ${message}`, entry);
      break;
    case "error":
      console.error(`[${component}] ${message}`, entry);
      break;
  }

  // In development, also emit structured JSON for dev tools
  if (process.env.NODE_ENV === "development") {
    const json = JSON.stringify(entry);
    // Use a trace prefix so dev tools can filter on it
    console.debug(`%c[trace]%c ${json}`, "color: #8b5cf6", "color: inherit");
  }
}

function log(level: LogLevel, component: string, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    data,
  };

  emit(entry);
}

export interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

export function createLogger(component: string): Logger {
  return {
    debug: (message, data) => log("debug", component, message, data),
    info: (message, data) => log("info", component, message, data),
    warn: (message, data) => log("warn", component, message, data),
    error: (message, data) => log("error", component, message, data),
  };
}
