import {
  NexxusBaseModel,
  INexxusBaseModel,
  MODEL_REGISTRY
} from "./BaseModel";

export type NexxusModelPrimitiveType = 'string' | 'number' | 'boolean' | 'date';
export type NexxusModelFieldType = NexxusModelPrimitiveType | 'array' | 'object';

interface BaseFieldDef {
  type: NexxusModelFieldType;
  required: boolean;
}

export interface PrimitiveFieldDef extends BaseFieldDef {
  type: NexxusModelPrimitiveType;
}

export interface NexxusArrayFieldDef extends BaseFieldDef {
  type: 'array';
  arrayType: NexxusModelPrimitiveType | 'object';
  properties?: Record<string, NexxusFieldDef>;
}

export interface NexxusObjectFieldDef extends BaseFieldDef {
  type: 'object';
  properties: Record<string, NexxusFieldDef>;
}

export type NexxusFieldDef = PrimitiveFieldDef | NexxusArrayFieldDef | NexxusObjectFieldDef;

export interface NexxusModelDef {
  [fieldName: string]: NexxusFieldDef;
}

export interface NexxusApplicationSchema {
  [modelName: string]: NexxusModelDef;
}

export type NexxusApplicationModelType = INexxusBaseModel & {
  name: string;
  description?: string;
  schema: NexxusApplicationSchema;
};

export class NexxusApplication extends NexxusBaseModel<NexxusApplicationModelType> {
  constructor(data: NexxusApplicationModelType) {
    super({ ...data, type: MODEL_REGISTRY.application });

    if (Object.keys(data.schema).length === 0) {
      throw new Error("Application schema cannot be empty");
    }

    //TODO: actually use json schema validation for schema structure
  }

  public getSchema(): NexxusApplicationSchema {
    return this.getData().schema;
  }

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}

