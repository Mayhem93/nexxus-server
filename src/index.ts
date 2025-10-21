import * as DB from "./lib/db";

export type BaseDBObject = { id: string; createdAt: string };

export const UserSchema = {
  id: "string",
  name: "string"
} as const;

export * from "./lib/db";
