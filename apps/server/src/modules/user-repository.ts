import { db } from "../db";
import { users, type User, type NewUser } from "../db/schema";

export function findAllUsers(): User[] {
  return db.select().from(users).all();
}

export function findUserById(id: number): User | undefined {
  return db.select().from(users).where(({ id: col }) => col).get();
}

export function createUser(input: NewUser): User {
  return db.insert(users).values(input).returning().get();
}
