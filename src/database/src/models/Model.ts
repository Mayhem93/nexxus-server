type NexxusGenericModel = {
  [key: string]: any | NexxusGenericModel;
};

export type NexxusBaseModel = NexxusGenericModel & {
  id: string | number;
  createdAt: number;
  updatedAt: number;
};

export abstract class NexxusModel {
  protected data: NexxusBaseModel;

  constructor(data: NexxusBaseModel) {
    this.data = data;
  }

  getData(): NexxusBaseModel {
    return this.data;
  }

  abstract save(): Promise<void>;
  abstract delete(): Promise<void>;
}
