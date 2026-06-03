import { Elysia, t } from "elysia";
import { userService } from "./service";
import { UserModel, CreateUserModel } from "./model";

export const userRoute = new Elysia({ prefix: "/users" })
  .get(
    "/",
    () => userService.findAll(),
    {
      response: t.Array(UserModel),
      detail: {
        summary: "获取所有用户",
        tags: ["用户"],
      },
    }
  )
  .get(
    "/:id",
    ({ params: { id } }) => {
      const user = userService.findById(Number(id));
      if (!user) {
        throw new Error("用户不存在");
      }
      return user;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: UserModel,
        404: t.Literal("用户不存在"),
      },
      detail: {
        summary: "根据ID获取用户",
        tags: ["用户"],
      },
    }
  )
  .post(
    "/",
    ({ body }) => userService.create(body),
    {
      body: CreateUserModel,
      response: UserModel,
      detail: {
        summary: "创建新用户",
        tags: ["用户"],
      },
    }
  );
