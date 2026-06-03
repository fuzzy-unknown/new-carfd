import { db } from "../../db";
import { generationRecords } from "../../db/schema";
import { MODELS, type ModelConfig } from "../../config/models";
import { UPLOADS_DIR } from "../../config/paths";
import { eq, and, or } from "drizzle-orm";
import path from "path";
import { mkdir, writeFile } from "node:fs/promises";
import { parseDashScopeError } from "../../utils/dashscope-errors";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || "";

export interface GenerationRequest {
  model: string;
  parameters: Record<string, any>;
}

export interface GenerationResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  result?: any;
  cost?: {
    inputTokens?: number;
    outputTokens?: number;
    totalPrice: number;
  };
  error?: string;
}

export class BailianService {
  private async createRecord(
    taskId: string,
    model: string,
    inputParams: Record<string, any>
  ) {
    const modelConfig = MODELS[model];
    if (!modelConfig) {
      throw new Error(`Invalid model: ${model}`);
    }

    await db.insert(generationRecords).values({
      taskId,
      model,
      category: modelConfig.category,
      status: 'pending',
      inputParams: JSON.stringify(inputParams),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  private async updateRecord(
    taskId: string,
    updates: Partial<{
      status: 'pending' | 'processing' | 'succeeded' | 'failed';
      inputParams: string;
      outputResult: string;
      cost: string;
      errorMessage: string;
    }>
  ) {
    await db
      .update(generationRecords)
      .set({
        ...updates,
        updatedAt: Date.now(),
      })
      .where(eq(generationRecords.taskId, taskId));
  }

  private calculateCost(
    model: string,
    usage?: any,
    imageSize?: string,
    videoDuration?: number,
    videoResolution?: string
  ): { inputTokens?: number; outputTokens?: number; totalPrice: number } {
    const modelConfig = MODELS[model];
    if (!modelConfig) {
      return { totalPrice: 0 };
    }

    const pricing = modelConfig.pricing;

    switch (pricing.unit) {
      case 'token':
        const inputTokens = usage?.input_tokens || 0;
        const outputTokens = usage?.output_tokens || 0;
        const totalPrice =
          (inputTokens / 1_000_000) * pricing.inputPrice +
          (outputTokens / 1_000_000) * (pricing.outputPrice || 0);
        return { inputTokens, outputTokens, totalPrice };

      case 'image':
        const n = usage?.image_count || 1;
        return { totalPrice: n * pricing.inputPrice };

      case 'video':
        const duration = videoDuration || 5;
        const is1080P = videoResolution === '1080P';
        const pricePerSecond = is1080P ? (pricing as any).inputPrice1080 || pricing.inputPrice : pricing.inputPrice;
        return { totalPrice: duration * pricePerSecond };

      default:
        return { totalPrice: 0 };
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveReferenceFile(file: File): Promise<{ id: string; type: 'image' | 'video'; url: string; name: string }> {
    const refsDir = path.join(UPLOADS_DIR, 'refs');
    await mkdir(refsDir, { recursive: true });

    const ext = file.name.split('.').pop() || 'png';
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fileName = `${id}.${ext}`;
    const fullPath = path.join(refsDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);

    const type = ['mp4', 'mov', 'avi', 'webm'].includes(ext.toLowerCase()) ? 'video' : 'image';

    return {
      id,
      type,
      url: `/api/uploads/refs/${fileName}`,
      name: file.name,
    };
  }

  async getReferenceDataUri(localUrl: string): Promise<string> {
    // Convert a local /api/uploads/refs/ path to base64 data URI
    const relativePath = localUrl.replace('/api/uploads/', '');
    const fullPath = path.join(UPLOADS_DIR, relativePath);

    const file = Bun.file(fullPath);
    if (!await file.exists()) {
      throw new Error(`Reference file not found: ${localUrl}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      bmp: 'image/bmp',
      mp4: 'video/mp4',
      mov: 'video/mov',
      webm: 'video/webm',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  private async downloadAndSaveFile(url: string, taskId: string, fileName: string): Promise<string> {
    const taskDir = path.join(UPLOADS_DIR, taskId);
    await mkdir(taskDir, { recursive: true });

    let buffer = Buffer.alloc(0);
    let ext = "mp4";

    if (url.startsWith("data:")) {
      const matches = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid data URI");
      ext = matches[1].split("/")[1] || "png";
      buffer = Buffer.from(matches[2], "base64");
    } else {
      // Retry up to 3 times with exponential backoff for transient network errors
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await this.sleep(1000 * Math.pow(2, attempt - 1));
        }
        try {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
            },
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          const contentType = response.headers.get("content-type") || "";
          ext = contentType.split("/")[1] || "mp4";
          lastError = null;
          break;
        } catch (err: any) {
          lastError = err;
          if (attempt < 2) {
            console.error(`Download attempt ${attempt + 1} failed for ${fileName} (task ${taskId}), retrying...`, err.message);
          }
        }
      }
      if (lastError) {
        throw new Error(`下载失败（已重试 3 次）：${lastError.message}`);
      }
    }

    const fullPath = path.join(taskDir, `${fileName}.${ext}`);
    await writeFile(fullPath, buffer);

    return `/api/uploads/${taskId}/${fileName}.${ext}`;
  }

  private async callDashScopeApi(url: string, body: any): Promise<any> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error: any) {
      throw new Error(`网络错误：无法连接百炼 API（${error.message || '未知网络错误'}）`);
    }

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}：百炼服务返回错误`);
      }
      const errMsg = parseDashScopeError(errorBody);
      throw new Error(errMsg);
    }

    const result = await response.json();

    // Check for DashScope-level errors (HTTP 200 but error in body)
    if (result.code || result.error?.code) {
      const errMsg = parseDashScopeError(result);
      throw new Error(errMsg);
    }

    return result;
  }

  private async queryDashScopeTask(taskId: string): Promise<any> {
    try {
      const response = await fetch(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        let errorBody: any;
        try {
          errorBody = await response.json();
        } catch {
          return null;
        }
        const errMsg = parseDashScopeError(errorBody);
        console.error(`Query task ${taskId} failed: ${errMsg}`);
        return null;
      }

      return await response.json();
    } catch (error: any) {
      console.error(`Query task ${taskId} network error:`, error);
      return null;
    }
  }

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const { model, parameters } = request;
    const modelConfig = MODELS[model];

    if (!modelConfig) {
      throw new Error(`Invalid model: ${model}`);
    }

    const taskId = `${model}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Strip internal fields for storage
    const { ref_media: _, ...storedParams } = parameters;

    if (modelConfig.category === 'video') {
      // Video is async: call DashScope API first, then create record with task_id
      // (avoids race condition with pollVideoTasks)
      return await this.generateVideo(model, parameters, storedParams, taskId);
    }

    // For sync models (text, image): create record first, then call API
    try {
      await this.createRecord(taskId, model, storedParams);

      if (modelConfig.category === 'text') {
        return await this.generateText(model, parameters, taskId);
      } else if (modelConfig.category === 'image') {
        return await this.generateImage(model, parameters, taskId);
      } else {
        throw new Error(`Unsupported category: ${modelConfig.category}`);
      }
    } catch (error: any) {
      await this.updateRecord(taskId, {
        status: 'failed',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  private async generateText(
    model: string,
    parameters: Record<string, any>,
    taskId: string
  ): Promise<GenerationResponse> {
    await this.updateRecord(taskId, { status: 'processing' });

    const result = await this.callDashScopeApi(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model,
        input: {
          messages: [
            {
              role: 'user',
              content: parameters.prompt || '',
            },
          ],
        },
        parameters: {
          max_tokens: parameters.max_tokens || 1500,
          temperature: parameters.temperature || 0.7,
          top_p: parameters.top_p || 0.9,
          result_format: 'message',
        },
      }
    );

    if (result.output && result.output.choices) {
      const text = result.output.choices[0]?.message?.content || '';
      const usage = result.usage;

      const cost = this.calculateCost(model, usage);

      await this.updateRecord(taskId, {
        status: 'succeeded',
        outputResult: JSON.stringify({ text }),
        cost: JSON.stringify(cost),
      });

      return {
        taskId,
        status: 'succeeded',
        result: { text },
        cost,
      };
    }

    throw new Error('文本生成失败：模型未返回有效结果');
  }

  private async generateImage(
    model: string,
    parameters: Record<string, any>,
    taskId: string
  ): Promise<GenerationResponse> {
    await this.updateRecord(taskId, { status: 'processing' });

    const result = await this.callDashScopeApi(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        model,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { text: parameters.prompt || '' },
              ],
            },
          ],
        },
        parameters: {
          size: parameters.size || '2048*2048',
          n: parameters.n || 1,
          negative_prompt: parameters.negative_prompt || '',
          watermark: parameters.watermark !== undefined ? parameters.watermark : false,
          prompt_extend: parameters.prompt_extend !== undefined ? parameters.prompt_extend : true,
        },
      }
    );

    if (result.output && result.output.choices) {
      const images = result.output.choices[0]?.message?.content || [];
      const usage = result.usage;

      // Download and save images locally
      const localImages = await Promise.all(
        images.map(async (item: any, i: number) => {
          if (item.image) {
            const localUrl = await this.downloadAndSaveFile(item.image, taskId, `img_${i}`);
            return { image: localUrl };
          }
          return item;
        })
      );

      const cost = this.calculateCost(model, usage);

      await this.updateRecord(taskId, {
        status: 'succeeded',
        outputResult: JSON.stringify({ images: localImages }),
        cost: JSON.stringify(cost),
      });

      return {
        taskId,
        status: 'succeeded',
        result: { images: localImages },
        cost,
      };
    }

    throw new Error('图像生成失败：模型未返回有效结果');
  }

  private async generateVideo(
    model: string,
    parameters: Record<string, any>,
    storedParams: Record<string, any>,
    taskId: string
  ): Promise<GenerationResponse> {
    // 视频生成是异步的：先调 API 拿到 dashscope task_id，再创建记录
    let result: any;
    try {
      const isR2V = model === 'happyhorse-1.0-r2v' || model === 'wan2.7-r2v';

      // Build input with optional media array for reference-based models
      const input: any = {
        prompt: parameters.prompt || '',
      };

      if (isR2V && Array.isArray(parameters.ref_media) && parameters.ref_media.length > 0) {
        // Convert local URLs to base64 data URIs for DashScope API
        input.media = await Promise.all(
          parameters.ref_media.map(async (ref: { url: string; type: string }) => {
            const url = ref.url.startsWith('/api/uploads/')
              ? await this.getReferenceDataUri(ref.url)
              : ref.url;
            return { type: ref.type, url };
          })
        );
      }

      const requestBody = {
        model,
        input,
        parameters: {
          resolution: parameters.resolution || '720P',
          ratio: parameters.ratio || '16:9',
          duration: parameters.duration || 5,
          watermark: parameters.watermark !== undefined ? parameters.watermark : true,
        },
      };

      // Log request (truncate base64 data URIs to avoid log pollution)
      const logSafeBody = JSON.parse(JSON.stringify(requestBody));
      if (logSafeBody.input?.media) {
        for (const m of logSafeBody.input.media) {
          if (typeof m.url === 'string' && m.url.startsWith('data:')) {
            m.url = m.url.substring(0, 80) + '...[base64, truncated]';
          }
        }
      }
      console.error(`[generateVideo] Request for ${model} (task ${taskId}):`, JSON.stringify(logSafeBody, null, 2));

      const response = await fetch(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        let errorBody: any;
        try {
          errorBody = await response.json();
        } catch {
          throw new Error(`HTTP ${response.status}：百炼服务返回错误`);
        }
        console.error(`[generateVideo] API error response for ${model}:`, JSON.stringify(errorBody, null, 2));
        const errMsg = parseDashScopeError(errorBody);
        // Include original message for known error codes to aid debugging
        const originalMsg = errorBody?.message || errorBody?.error?.message || '';
        throw new Error(originalMsg ? `${errMsg}（原始信息：${originalMsg}）` : errMsg);
      }

      result = await response.json();

      if (result.code || result.error?.code) {
        console.error(`[generateVideo] API result error for ${model}:`, JSON.stringify(result, null, 2));
        const errMsg = parseDashScopeError(result);
        const originalMsg = result?.message || result?.error?.message || '';
        throw new Error(originalMsg ? `${errMsg}（原始信息：${originalMsg}）` : errMsg);
      }
    } catch (error: any) {
      // Create a failed record in one shot (avoid race with poller)
      const errMsg = error.message?.startsWith('HTTP') || error.message?.includes('百炼')
        ? error.message
        : `网络错误：无法连接百炼 API（${error.message || '未知网络错误'}）`;
      const modelConfig = MODELS[model];
      await db.insert(generationRecords).values({
        taskId,
        model,
        category: modelConfig?.category || 'video',
        status: 'failed',
        inputParams: JSON.stringify(storedParams),
        errorMessage: errMsg,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).catch(() => {});
      throw new Error(errMsg);
    }

    if (result.output && result.output.task_id) {
      // Create record WITH dashscope task_id — no race condition possible
      await this.createRecord(taskId, model, {
        ...storedParams,
        _dashscope_task_id: result.output.task_id,
      });

      return {
        taskId,
        status: 'pending',
      };
    }

    throw new Error('视频任务创建失败：百炼未返回任务 ID');
  }

  async pollVideoTasks() {
    const staleThreshold = Date.now() - 4 * 60 * 60 * 1000; // 4 hours
    const pendingRecords = await db
      .select()
      .from(generationRecords)
      .where(
        and(
          eq(generationRecords.category, 'video'),
          or(
            eq(generationRecords.status, 'pending'),
            eq(generationRecords.status, 'processing')
          )
        )
      )
      .limit(10);

    for (const record of pendingRecords) {
      if (!record.taskId || !record.model) {
        // Clean up records with missing IDs
        await db
          .update(generationRecords)
          .set({ status: 'failed', errorMessage: '记录数据不完整', updatedAt: Date.now() })
          .where(eq(generationRecords.id, record.id));
        continue;
      }

      // Mark stale tasks as failed
      if (record.createdAt < staleThreshold) {
        await this.updateRecord(record.taskId, {
          status: 'failed',
          errorMessage: '视频生成超时：任务超过 4 小时未完成，已自动取消',
        });
        continue;
      }

      const inputParams = JSON.parse(record.inputParams);
      const dashscopeTaskId = inputParams._dashscope_task_id;
      if (!dashscopeTaskId) {
        await this.updateRecord(record.taskId, {
          status: 'failed',
          errorMessage: '系统错误：缺少百炼任务 ID',
        });
        continue;
      }

      // Mark as processing if still pending
      if (record.status === 'pending') {
        await this.updateRecord(record.taskId, { status: 'processing' });
      }

      const result = await this.queryDashScopeTask(dashscopeTaskId);
      if (!result || !result.output) {
        // Transient network error, skip this poll cycle
        continue;
      }

      const taskStatus = result.output.task_status;

      if (taskStatus === 'SUCCEEDED') {
        // Try multiple possible response formats
        const results = result.output.results || [];
        const videoUrl =
          results[0]?.video_url ||
          results[0]?.url ||
          result.output.video_url ||
          result.output.result?.video_url;

        if (!videoUrl) {
          console.error(
            `Video task ${dashscopeTaskId} SUCCEEDED but no URL found. Response:`,
            JSON.stringify(result.output)
          );
          await this.updateRecord(record.taskId, {
            status: 'failed',
            errorMessage: '视频生成成功但未返回下载链接，请重试',
          });
          continue;
        }

        try {
          const localUrl = await this.downloadAndSaveFile(videoUrl, record.taskId, 'video');
          const resolution = inputParams.resolution || '720P';
          const duration = inputParams.duration || 5;
          const cost = this.calculateCost(record.model, undefined, undefined, duration, resolution);

          await this.updateRecord(record.taskId, {
            status: 'succeeded',
            outputResult: JSON.stringify({ results: [{ video_url: localUrl }] }),
            cost: JSON.stringify(cost),
          });
        } catch (dlError: any) {
          await this.updateRecord(record.taskId, {
            status: 'failed',
            errorMessage: `视频下载失败：${dlError.message || '未知错误'}`,
          });
        }
      } else if (taskStatus === 'FAILED') {
        console.error(`[pollVideoTasks] Task ${dashscopeTaskId} FAILED:`, JSON.stringify(result.output, null, 2));
        const errorMsg = parseDashScopeError(result.output);
        await this.updateRecord(record.taskId, {
          status: 'failed',
          errorMessage: errorMsg,
        });
      }
      // PENDING / RUNNING → still in progress, skip
    }
  }

  startVideoPoller() {
    setInterval(() => {
      this.pollVideoTasks().catch((err) =>
        console.error("Video task poller error:", err)
      );
    }, 5000);
    console.log("Video task poller started (interval: 5s)");
  }

  async getRecords(limit: number = 50) {
    const records = await db
      .select()
      .from(generationRecords)
      .orderBy(generationRecords.createdAt)
      .limit(limit);

    return records.map((record) => {
      const rawParams = JSON.parse(record.inputParams);
      // Strip internal fields from response
      const { _dashscope_task_id, ...inputParams } = rawParams;
      return {
        id: record.id,
        taskId: record.taskId,
        model: record.model,
        category: record.category,
        status: record.status,
        inputParams,
        outputResult: record.outputResult ? JSON.parse(record.outputResult) : null,
        cost: record.cost ? JSON.parse(record.cost) : null,
        errorMessage: record.errorMessage,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    });
  }

  async getRecordById(id: number) {
    const record = await db
      .select()
      .from(generationRecords)
      .where(eq(generationRecords.id, id))
      .limit(1);

    if (record.length === 0) {
      return null;
    }

    const r = record[0];
    const rawParams = JSON.parse(r.inputParams);
    const { _dashscope_task_id, ...inputParams } = rawParams;
    return {
      id: r.id,
      taskId: r.taskId,
      model: r.model,
      category: r.category,
      status: r.status,
      inputParams,
      outputResult: r.outputResult ? JSON.parse(r.outputResult) : null,
      cost: r.cost ? JSON.parse(r.cost) : null,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async getSupportedModels() {
    return Object.values(MODELS).map((model) => ({
      id: model.id,
      name: model.name,
      category: model.category,
      type: model.type,
      description: model.description,
      pricing: model.pricing,
      parameters: model.parameters,
    }));
  }

  async getStatistics() {
    const records = await db
      .select()
      .from(generationRecords)
      .where(eq(generationRecords.status, 'succeeded'));

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const thirtyDaysMs = 30 * oneDayMs;

    // 总消费
    const totalCost = records.reduce((sum, r) => {
      const cost = r.cost ? JSON.parse(r.cost) : null;
      return sum + (cost?.totalPrice || 0);
    }, 0);

    // 今日消费
    const todayCost = records.reduce((sum, r) => {
      if (now - r.createdAt <= oneDayMs) {
        const cost = r.cost ? JSON.parse(r.cost) : null;
        return sum + (cost?.totalPrice || 0);
      }
      return sum;
    }, 0);

    // 本周消费
    const weekCost = records.reduce((sum, r) => {
      if (now - r.createdAt <= sevenDaysMs) {
        const cost = r.cost ? JSON.parse(r.cost) : null;
        return sum + (cost?.totalPrice || 0);
      }
      return sum;
    }, 0);

    // 本月消费
    const monthCost = records.reduce((sum, r) => {
      if (now - r.createdAt <= thirtyDaysMs) {
        const cost = r.cost ? JSON.parse(r.cost) : null;
        return sum + (cost?.totalPrice || 0);
      }
      return sum;
    }, 0);

    // 各模型消费统计
    const modelStats = new Map<string, { count: number; cost: number }>();
    records.forEach((r) => {
      const cost = r.cost ? JSON.parse(r.cost) : null;
      const current = modelStats.get(r.model) || { count: 0, cost: 0 };
      modelStats.set(r.model, {
        count: current.count + 1,
        cost: current.cost + (cost?.totalPrice || 0),
      });
    });

    // 各类别消费统计
    const categoryStats = new Map<string, { count: number; cost: number }>();
    records.forEach((r) => {
      const cost = r.cost ? JSON.parse(r.cost) : null;
      const current = categoryStats.get(r.category) || { count: 0, cost: 0 };
      categoryStats.set(r.category, {
        count: current.count + 1,
        cost: current.cost + (cost?.totalPrice || 0),
      });
    });

    // 每日消费趋势（最近30天）
    const dailyTrend = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now - i * oneDayMs);
      const dateStr = date.toISOString().split('T')[0];
      dailyTrend.set(dateStr, 0);
    }

    records.forEach((r) => {
      const cost = r.cost ? JSON.parse(r.cost) : null;
      const date = new Date(r.createdAt);
      const dateStr = date.toISOString().split('T')[0];
      if (dailyTrend.has(dateStr)) {
        dailyTrend.set(dateStr, dailyTrend.get(dateStr)! + (cost?.totalPrice || 0));
      }
    });

    return {
      totalCost,
      todayCost,
      weekCost,
      monthCost,
      totalRecords: records.length,
      modelStats: Array.from(modelStats.entries()).map(([model, data]) => ({
        model,
        modelName: MODELS[model]?.name || model,
        ...data,
      })),
      categoryStats: Array.from(categoryStats.entries()).map(([category, data]) => ({
        category,
        ...data,
      })),
      dailyTrend: Array.from(dailyTrend.entries())
        .map(([date, cost]) => ({ date, cost }))
        .reverse(),
    };
  }
}

export const bailianService = new BailianService();
