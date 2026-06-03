import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoute } from "./modules/health";
import { userRoute } from "./modules/user";

const PORT = 3001;

const app = new Elysia({ prefix: "/api" })
  .use(cors())
  .use(healthRoute)
  .use(userRoute)
  .listen(PORT);

console.log(`Server running at http://localhost:${app.server!.port}`);
