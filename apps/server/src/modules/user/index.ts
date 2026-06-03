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
    ({ params: { id }, error }) => {
      const user = userService.findById(Number(id));
      if (!user) {
        return error(404, { message: "用户不存在" });
      }
      return user;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: UserModel,
        404: t.Object({ message: t.String() }),
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
