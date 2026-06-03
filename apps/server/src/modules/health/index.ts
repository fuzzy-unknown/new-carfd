import { Elysia, t } from "elysia";

const HealthResponseModel = t.Object({
  status: t.Literal("ok"),
  timestamp: t.String(),
});

type HealthResponse = typeof HealthResponseModel.static;

export const healthRoute = new Elysia({ prefix: "/health" })
  .model({
    health: HealthResponseModel,
  })
  .get(
    "/",
    (): HealthResponse => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
    {
      response: "health",
      detail: {
        summary: "健康检查端点",
        tags: ["健康检查"],
      },
    }
  );
