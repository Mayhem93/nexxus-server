import { randomUUID } from "node:crypto"
import { NexxusApplication } from "./Application";
import { NexxusAppModel } from "./AppModel";

interface NexxusGenericModel {
  [key: string]: any | NexxusGenericModel;
};

export type AnyNexxusModel = NexxusApplication | NexxusAppModel; // Extend this union as more built-in models are added

export interface INexxusBaseModel extends NexxusGenericModel {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  type: string;
};

export const MODEL_REGISTRY = {
  application: 'application',
  // Add other built-in models here as you create them
  // device: 'device',
  // user: 'user',
} as const;

export type ModelTypeName = typeof MODEL_REGISTRY[keyof typeof MODEL_REGISTRY];

// Map model type names to their class types
export interface ModelTypeMap {
  application: NexxusApplication;
  // Add mappings for other built-in models
  // device: NexxusDevice;
}

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
