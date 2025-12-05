import {
  NexxusBaseModel,
  INexxusBaseModel,
  MODEL_REGISTRY
} from "./BaseModel";

type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';

interface BaseFieldDef {
  type: FieldType;
  required: boolean;
}

interface PrimitiveFieldDef extends BaseFieldDef {
  type: 'string' | 'number' | 'boolean';
}

interface ArrayFieldDef extends BaseFieldDef {
  type: 'array';
  arrayType: FieldType;
  properties?: Record<string, FieldDef>;
}

interface ObjectFieldDef extends BaseFieldDef {
  type: 'object';
  properties: Record<string, FieldDef>;
}

type FieldDef = PrimitiveFieldDef | ArrayFieldDef | ObjectFieldDef;

interface ModelDef {
  [fieldName: string]: FieldDef;
}

export interface NexxusApplicationSchema {
  [modelName: string]: ModelDef;
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

