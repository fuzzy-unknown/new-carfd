import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { User, CreateUser } from "./model";

export class UserService {
  findAll(): User[] {
    return db.select().from(users).all();
  }

  findById(id: number): User | null {
    return db.select().from(users).where(eq(users.id, id)).get() ?? null;
  }

  create(input: CreateUser): User {
    return db.insert(users).values(input).returning().get();
  }
}

export const userService = new UserService();
