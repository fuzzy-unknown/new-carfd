import { t } from "elysia";

export const UserModel = t.Object({
  id: t.Number(),
  name: t.String(),
  email: t.String({ format: "email" }),
  createdAt: t.Number(),
});

export const CreateUserModel = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: "email" }),
});

export type User = typeof UserModel.static;
export type CreateUser = typeof CreateUserModel.static;
