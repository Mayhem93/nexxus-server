export type BaseDBObject = { id: string; createdAt: string };

export const UserSchema = {
  id: "string",
  name: "string",
  test: "string"
} as const;

export * from "./lib/db";
