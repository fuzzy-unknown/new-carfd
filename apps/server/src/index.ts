import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { healthRoute } from "./modules/health";
import { userRoute } from "./modules/user";
import { initializeDatabase } from "./db";

const PORT = 5001;

async function start() {
  await initializeDatabase();

  const app = new Elysia({ prefix: "/api" })
    .use(cors())
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
          ],
        },
      })
    )
    .use(healthRoute)
    .use(userRoute)
    .listen(PORT);

  console.log(`Server running at http://localhost:${app.server!.port}`);
  console.log(`OpenAPI documentation at http://localhost:${app.server!.port}/api/swagger`);
}

start();
