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
  .post(
    "/upload",
    async ({ request }) => {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return { error: "请上传文件" };
      }
      return await bailianService.saveReferenceFile(file);
    },
    {
      detail: {
        summary: "上传参考素材（图片/视频）",
        tags: ["百炼"],
      },
    }
  )
  .post(
    "/explore/analyze",
    async ({ body }) => {
      return await bailianService.analyzeStory(body.story);
    },
    {
      body: t.Object({ story: t.String() }),
      detail: {
        summary: "分析故事，分解为场景",
        tags: ["百炼"],
      },
    }
  )
  .post(
    "/explore/scenes/:id/generate",
    async ({ params, body }) => {
      return await bailianService.generateSceneVideo(Number(params.id), body);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(t.Object({
        model: t.Optional(t.String()),
        resolution: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
      })),
      detail: {
        summary: "生成场景视频",
        tags: ["百炼"],
      },
    }
  )
  .get(
    "/explore/projects",
    async () => {
      return await bailianService.getAllProjects();
    },
    {
      detail: {
        summary: "获取所有故事项目列表",
        tags: ["百炼"],
      },
    }
  )
  .get(
    "/explore/projects/:id",
    async ({ params }) => {
      return await bailianService.getProjectWithScenes(Number(params.id));
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "获取故事项目详情及场景",
        tags: ["百炼"],
      },
    }
  )
  .post(
    "/explore/characters/:id/upload",
    async ({ params, request }) => {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return { error: "请上传文件" };
      }
      return await bailianService.uploadCharacterReference(Number(params.id), file);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "上传角色参考图片",
        tags: ["百炼"],
      },
    }
  )
  .post(
    "/explore/projects/:id/delete",
    async ({ params }) => {
      return await bailianService.softDeleteProject(Number(params.id));
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "软删除故事项目",
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
