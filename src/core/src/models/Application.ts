import {
  NexxusBaseModel,
  INexxusBaseModel,
  MODEL_REGISTRY
} from "./BaseModel";
import { NexxusModelDef } from "../common/ModelTypes";
import { NexxusUserDetailSchema } from "./User";

import * as Dot from 'dot-prop';

export interface NexxusApplicationSchema {
  [modelName: string]: NexxusModelDef;
}

export type NexxusApplicationModelType = INexxusBaseModel<'application'> & {
  name: string;
  description?: string;
  schema: NexxusApplicationSchema;
  authEnabled: boolean;
  userDetailSchema?: NexxusUserDetailSchema;
};

export class NexxusApplication extends NexxusBaseModel<NexxusApplicationModelType> {
  constructor(data: NexxusApplicationModelType) {
    super({ ...data, type: MODEL_REGISTRY.application });

    if (Object.keys(data.schema).length === 0) {
      throw new Error("Application schema cannot be empty");
    }

    if (data.authEnabled === undefined || typeof data.authEnabled !== 'boolean') {
      throw new Error("Application 'authEnabled' is required and must be a boolean");
    } else if (data.authEnabled && (!data.userDetailSchema || typeof data.userDetailSchema !== 'object')) {
      throw new Error("Application 'userSchema' must be provided when 'authEnabled' is true");
    }

    //TODO: actually use json schema validation for schema structure
  }

  public getSchema(): NexxusApplicationSchema {
    return this.getData().schema;
  }

  public getUserDetailSchema(): NexxusUserDetailSchema | undefined {
    return this.getData().userDetailSchema;
  }

/*   public validateUserDetails(partialDetails: Record<string, any>): boolean {
    const userDetailSchema = this.data.userDetailSchema;

    if (!userDetailSchema) {
      return true; // No schema to validate against
    }

    for (const field in partialDetails) {
      const fieldDef = userDetailSchema[field];
      const fieldValue = partialDetails[field];

      if (!fieldDef) {
        return false; // Field not defined in schema
      }

      switch (fieldDef.type) {
        case 'string':
          if (typeof fieldValue !== 'string') return false;
          break;
        case 'number':
          if (typeof fieldValue !== 'number') return false;
          break;
        case 'boolean':
          if (typeof fieldValue !== 'boolean')
            return false;


          break;
        case 'object':
          if (typeof fieldValue !== 'object' || Array.isArray(fieldValue)) return false;
          break;
        case 'array':
          if (!Array.isArray(fieldValue)) return false;
          break;
        default:
          return false; // Unknown field type
      }
    }

    return true; // All fields are valid
  } */

  public getAppModelFieldType(modelType: string, fieldPath: string): string | undefined {
    const appModelFieldType = Dot.getProperty(this.getSchema(), `${modelType}.${fieldPath}.type`);

    return appModelFieldType as string | undefined;
  }

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}

