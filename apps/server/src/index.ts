import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { healthRoute } from "./modules/health";
import { userRoute } from "./modules/user";
import { bailianRoute, bailianService } from "./modules/bailian";
import { initializeDatabase } from "./db";

import path from "path";
import { UPLOADS_DIR } from "./config/paths";

const PORT = Number(process.env.PORT) || 5001;

async function start() {
  await initializeDatabase();

  // Start background poller for async video tasks
  bailianService.startVideoPoller();

  const app = new Elysia({ prefix: "/api" })
    .use(cors({
      origin: ["http://localhost:5000", process.env.FRONTEND_URL].filter(Boolean) as string[],
      credentials: true,
    }))
    .use(
      openapi({
        documentation: {
          info: {
            title: "ElysiaJS API",
            version: "1.0.0",
            description: "规范化的 ElysiaJS 后端 API",
          },
          tags: [
            { name: "健康检查", description: "健康检查端点" },
            { name: "用户", description: "用户管理端点" },
            { name: "百炼", description: "百炼 AI 模型端点" },
          ],
        },
      })
    )
    .use(healthRoute)
    .use(userRoute)
    .use(bailianRoute)
    // Serve uploaded files
    .get("/uploads/*", async ({ params, set }) => {
      const filePath = path.join(UPLOADS_DIR, params["*"]);
      // Prevent directory traversal
      if (!filePath.startsWith(UPLOADS_DIR)) {
        set.status = 403;
        return "Forbidden";
      }
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
      set.status = 404;
      return "Not found";
    })
    .listen(PORT);

  console.log(`Server running at http://localhost:${app.server!.port}`);
  console.log(`OpenAPI documentation at http://localhost:${app.server!.port}/api/openapi`);
}

start();
