import { parseJSON } from "./json";
import { parseDashScopeError } from "../utils/dashscope-errors";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || "";

const TEXT_API = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const VIDEO_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/generation";
const TASK_API = "https://dashscope.aliyuncs.com/api/v1/tasks";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BailianClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || DASHSCOPE_API_KEY;
  }

  /**
   * Call a Qwen text model with a system+user prompt and parse the response as JSON.
   * Retries on network errors up to 2 times.
   */
  async chatJSON<T>(options: {
    system: string;
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<T> {
    const {
      system,
      prompt,
      model = "qwen3.7-plus",
      temperature = 0.7,
      maxTokens = 4096,
    } = options;

    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(TEXT_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorBody: any;
          try {
            errorBody = await response.json();
          } catch {
            throw new Error(`HTTP ${response.status}：百炼服务返回错误`);
          }
          throw new Error(parseDashScopeError(errorBody));
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(parseDashScopeError(result));
        }

        const content = result.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("模型返回为空");
        }

        return parseJSON<T>(content);
      } catch (err: any) {
        lastError = err;
        // Only retry on network errors
        if (
          err.message?.includes("网络错误") ||
          err.message?.includes("fetch") ||
          err.message?.includes("NetworkError") ||
          err.message?.includes("ECONNREFUSED")
        ) {
          if (attempt < 2) {
            await sleep(1000 * Math.pow(2, attempt));
            continue;
          }
        }
        // Non-network errors: don't retry
        throw err;
      }
    }

    throw lastError!;
  }

  /**
   * Create an async video generation task on DashScope.
   */
  async generateVideoTask(options: {
    model: string;
    input: Record<string, any>;
    parameters: Record<string, any>;
  }): Promise<{ dashscopeTaskId: string; raw: any }> {
    const { model, input, parameters } = options;

    const body = {
      model,
      input,
      parameters,
    };

    console.log("[bailian-client] generateVideoTask request:", JSON.stringify({
      model,
      inputKeys: Object.keys(input),
      promptLen: input.prompt?.length,
      hasMedia: !!input.media,
      mediaCount: input.media?.length,
      parameters,
    }, null, 2));
    console.log("[bailian-client] generateVideoTask full request body:", JSON.stringify(body, null, 2));

    const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}：百炼服务返回错误`);
      }
      console.error("[bailian-client] generateVideoTask ERROR:", JSON.stringify(errorBody, null, 2));
      throw new Error(parseDashScopeError(errorBody));
    }

    const result = await response.json();

    if (result.code || result.error) {
      console.error("[bailian-client] generateVideoTask API error:", JSON.stringify(result, null, 2));
      throw new Error(parseDashScopeError(result));
    }

    const taskId = result.output?.task_id;
    if (!taskId) {
      throw new Error("视频任务创建失败：未返回 task_id");
    }

    return { dashscopeTaskId: taskId, raw: result };
  }

  /**
   * Query a DashScope async task status.
   */
  async queryTask(taskId: string): Promise<any> {
    try {
      const response = await fetch(`${TASK_API}/${taskId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        let errorBody: any;
        try {
          errorBody = await response.json();
        } catch {
          return null;
        }
        console.error(`Query task ${taskId} failed: ${parseDashScopeError(errorBody)}`);
        return null;
      }

      return await response.json();
    } catch (error: any) {
      console.error(`Query task ${taskId} network error:`, error);
      return null;
    }
  }
}
