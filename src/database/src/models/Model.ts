import { randomUUID } from "node:crypto"

type NexxusGenericModel = {
  [key: string]: any | NexxusGenericModel;
};

export type NexxusBaseModelType = NexxusGenericModel & {
  id: string;
  createdAt: number;
  updatedAt: number;
  type?: string;
};

export abstract class NexxusBaseModel {
  protected data: NexxusBaseModelType;

  constructor(data: NexxusBaseModelType) {
    this.data = data;

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

  getData(): NexxusBaseModelType {
    return this.data;
  }

  abstract save(): Promise<void>;
  abstract delete(): Promise<void>;
}
