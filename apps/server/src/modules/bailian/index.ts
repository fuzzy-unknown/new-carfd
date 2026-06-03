import { Elysia, t } from "elysia";
import { bailianService } from "./service";
export { bailianService };

const GenerationRequestModel = t.Object({
  model: t.String(),
  parameters: t.Record(t.String(), t.Any()),
});

const GenerationResponseModel = t.Object({
  taskId: t.String(),
  status: t.Union([
    t.Literal("pending"),
    t.Literal("processing"),
    t.Literal("succeeded"),
    t.Literal("failed"),
  ]),
  result: t.Optional(t.Any()),
  cost: t.Optional(t.Object({
    inputTokens: t.Optional(t.Number()),
    outputTokens: t.Optional(t.Number()),
    totalPrice: t.Number(),
  })),
  error: t.Optional(t.String()),
});

export const bailianRoute = new Elysia({ prefix: "/bailian" })
  .get(
    "/models",
    () => bailianService.getSupportedModels(),
    {
      detail: {
        summary: "获取支持的模型列表",
        tags: ["百炼"],
      },
    }
  )
  .post(
    "/generate",
    async ({ body }) => {
      const result = await bailianService.generate(body);
      return result;
    },
    {
      body: GenerationRequestModel,
      response: GenerationResponseModel,
      detail: {
        summary: "调用百炼模型生成内容",
        tags: ["百炼"],
      },
    }
  )
  .get(
    "/records",
    async ({ query }) => {
      const limit = query.limit ? Number(query.limit) : 50;
      return await bailianService.getRecords(limit);
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "获取生成记录列表",
        tags: ["百炼"],
      },
    }
  )
  .get(
    "/records/:id",
    async ({ params, error }) => {
      const record = await bailianService.getRecordById(Number(params.id));
      if (!record) {
        return error(404, { message: "记录不存在" });
      }
      return record;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Any(),
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: "根据ID获取生成记录",
        tags: ["百炼"],
      },
    }
  )
  .get(
    "/statistics",
    async () => {
      return await bailianService.getStatistics();
    },
    {
      detail: {
        summary: "获取计费统计数据",
        tags: ["百炼"],
      },
    }
  );
