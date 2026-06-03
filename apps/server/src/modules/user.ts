import { Elysia, t } from "elysia";
import { findAllUsers } from "./user-repository";

export const userRoute = new Elysia({ prefix: "/users" }).get(
  "/",
  () => findAllUsers(),
  {
    response: t.Array(
      t.Object({
        id: t.Number(),
        name: t.String(),
        email: t.String(),
        createdAt: t.Number(),
      })
    ),
  }
);
