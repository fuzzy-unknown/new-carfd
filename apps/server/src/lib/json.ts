/**
 * JSON parsing utilities for AI model responses.
 * Handles markdown code blocks and extracts JSON from mixed text.
 */

/**
 * Strip ```json ... ``` code block wrappers and extract the inner content.
 */
function stripCodeBlock(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return text.trim();
}

/**
 * Extract the first JSON object or array from a string.
 */
function extractFirstJSON(text: string): string {
  // Try to find a JSON object
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");

  if (objStart === -1 && arrStart === -1) {
    return text;
  }

  // Decide whether to parse object or array based on which comes first
  const start = arrStart !== -1 && (objStart === -1 || arrStart < objStart)
    ? arrStart
    : objStart;
  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text.slice(start);
}

/**
 * Parse a JSON string from an AI model response.
 * Handles code blocks and extracts JSON from surrounding text.
 */
export function parseJSON<T = unknown>(raw: string, step?: string): T {
  const cleaned = stripCodeBlock(raw);
  const extracted = extractFirstJSON(cleaned);

  try {
    return JSON.parse(extracted) as T;
  } catch {
    const preview = extracted.slice(0, 500);
    const stepInfo = step ? ` (step: ${step})` : "";
    throw new Error(
      `JSON 解析失败${stepInfo}，原始片段前 500 字：${preview}`
    );
  }
}
