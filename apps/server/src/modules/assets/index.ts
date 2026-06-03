import { Elysia, t } from "elysia";
import { assetsService } from "./service";

export const assetsRoute = new Elysia({ prefix: "/assets" })
  .get(
    "/",
    async ({ query }) => {
      const type = query.type || "all"; // all | image | video
      const source = query.source || "all"; // all | workspace | novel
      return await assetsService.getAssets(type, source);
    },
    {
      query: t.Object({
        type: t.Optional(t.Union([
          t.Literal("all"),
          t.Literal("image"),
          t.Literal("video"),
        ])),
        source: t.Optional(t.Union([
          t.Literal("all"),
          t.Literal("workspace"),
          t.Literal("novel"),
        ])),
      }),
      detail: {
        summary: "获取所有资产（图片和视频）",
        tags: ["资产"],
      },
    }
  )
  .get(
    "/stats",
    async () => {
      return await assetsService.getAssetStats();
    },
    {
      detail: {
        summary: "获取资产统计信息",
        tags: ["资产"],
      },
    }
  );
