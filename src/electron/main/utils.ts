export const DEV_MODE = process.env.DEV_MODE === "1" || process.env.NODE_ENV === "development";

export function log(...args: unknown[]): void {
  if (DEV_MODE) {
    console.log("[main]", ...args);
  }
}

export function logError(...args: unknown[]): void {
  console.error("[main:error]", ...args);
}
