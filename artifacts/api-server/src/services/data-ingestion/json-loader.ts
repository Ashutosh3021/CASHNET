/**
 * JSON loader — reads JSON files and returns raw records.
 */

import * as fs from "fs";

export function loadJSON(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
    if (data && typeof data === "object") {
      if (Array.isArray(data.records)) return data.records;
      if (Array.isArray(data.data)) return data.data;
    }
    return [];
  } catch {
    return [];
  }
}

export function parseJSONString(jsonContent: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(jsonContent);
    if (Array.isArray(data)) return data.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
    return [];
  } catch {
    return [];
  }
}
