import { db } from "../../db";
import { generationRecords } from "../../db/schema";
import { MODELS, type ModelConfig } from "../../config/models";
import { eq } from "drizzle-orm";

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

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const { model, parameters } = request;
    const modelConfig = MODELS[model];

    if (!modelConfig) {
      throw new Error(`Invalid model: ${model}`);
    }

    const taskId = `${model}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
      // 创建记录
      await this.createRecord(taskId, model, parameters);

      // 调用百炼 API
      if (modelConfig.category === 'text') {
        return await this.generateText(model, parameters, taskId);
      } else if (modelConfig.category === 'image') {
        return await this.generateImage(model, parameters, taskId);
      } else if (modelConfig.category === 'video') {
        return await this.generateVideo(model, parameters, taskId);
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

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    const result = await response.json();

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
    } else {
      throw new Error(result.message || 'Text generation failed');
    }
  }

  private async generateImage(
    model: string,
    parameters: Record<string, any>,
    taskId: string
  ): Promise<GenerationResponse> {
    await this.updateRecord(taskId, { status: 'processing' });

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    const result = await response.json();

    if (result.output && result.output.choices) {
      const images = result.output.choices[0]?.message?.content || [];
      const usage = result.usage;

      const cost = this.calculateCost(model, usage);

      await this.updateRecord(taskId, {
        status: 'succeeded',
        outputResult: JSON.stringify({ images }),
        cost: JSON.stringify(cost),
      });

      return {
        taskId,
        status: 'succeeded',
        result: { images },
        cost,
      };
    } else {
      throw new Error(result.message || 'Image generation failed');
    }
  }

  private async generateVideo(
    model: string,
    parameters: Record<string, any>,
    taskId: string
  ): Promise<GenerationResponse> {
    // 视频生成是异步的，需要先创建任务
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model,
        input: {
          prompt: parameters.prompt || '',
        },
        parameters: {
          resolution: parameters.resolution || '720P',
          ratio: parameters.ratio || '16:9',
          duration: parameters.duration || 5,
          watermark: parameters.watermark !== undefined ? parameters.watermark : true,
        },
      }),
    });

    const result = await response.json();

    if (result.output && result.output.task_id) {
      // 异步任务已创建，返回任务 ID
      return {
        taskId,
        status: 'pending',
      };
    } else {
      throw new Error(result.message || 'Video generation task creation failed');
    }
  }

  async getRecords(limit: number = 50) {
    const records = await db
      .select()
      .from(generationRecords)
      .orderBy(generationRecords.createdAt)
      .limit(limit);

    return records.map((record) => ({
      id: record.id,
      taskId: record.taskId,
      model: record.model,
      category: record.category,
      status: record.status,
      inputParams: JSON.parse(record.inputParams),
      outputResult: record.outputResult ? JSON.parse(record.outputResult) : null,
      cost: record.cost ? JSON.parse(record.cost) : null,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
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
    return {
      id: r.id,
      taskId: r.taskId,
      model: r.model,
      category: r.category,
      status: r.status,
      inputParams: JSON.parse(r.inputParams),
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
}

export const bailianService = new BailianService();
