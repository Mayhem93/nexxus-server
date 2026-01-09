import { NexxusApplication, NexxusApplicationModelType } from "./Application";
import { NexxusApplicationUser, NexxusUserModelType } from "./User";
import { NexxusAppModel, NexxusAppModelType } from "./AppModel";

import { randomUUID } from "node:crypto"

export type AnyNexxusModel = NexxusApplication | NexxusApplicationUser | NexxusAppModel; // Extend this union as more built-in models are added
export type AnyNexxusModelType = NexxusApplicationModelType | NexxusUserModelType | NexxusAppModelType; // Extend this union as more built-in models are added

export interface INexxusBaseModel<TType extends string = string> {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  type: TType;
}

export const MODEL_REGISTRY = {
  application: 'application',
  user: 'user'
} as const;

export type NexxusBuiltinModelTypeName = typeof MODEL_REGISTRY[keyof typeof MODEL_REGISTRY];
export type NexxusModelTypeName = NexxusBuiltinModelTypeName | string;

export abstract class NexxusBaseModel<T extends INexxusBaseModel = INexxusBaseModel> {
  protected data: T;

  public static readonly modelType: string | undefined;

  constructor(data: T) {
    this.data = data;

    if (!this.data.type) {
      throw new Error("Model 'type' is required");
    }

    const now = Math.floor(Date.now()/1000);

    if (this.data.id === undefined) {
      this.data.id = randomUUID();
    }

    if (this.data.createdAt === undefined) {
      this.data.createdAt = now;
    }

    if (this.data.updatedAt === undefined) {
      this.data.updatedAt = now;
    }
  }

  getData(): T {
    return this.data;
  }

  abstract save(): Promise<void>;
  abstract delete(): Promise<void>;
}
