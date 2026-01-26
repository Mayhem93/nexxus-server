import {
  NexxusBaseModel,
  INexxusBaseModel,
  MODEL_REGISTRY
} from "./BaseModel";
import { NexxusFieldDef, NexxusModelDef } from "../common/ModelTypes";
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
  allowMultipleLogin: boolean | null;
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

    if (data.authEnabled && typeof data.allowMultipleLogin !== 'boolean' && data.allowMultipleLogin !== undefined) {
      throw new Error("Application 'allowMultipleLogin' must be a boolean when 'authEnabled' is enabled");
    }

    data.allowMultipleLogin = data.authEnabled ? data.allowMultipleLogin || true : null;

    //TODO: actually use json schema validation for schema structure
  }

  public getSchema(): NexxusApplicationSchema {
    return this.getData().schema;
  }

  public getUserDetailSchema(): NexxusUserDetailSchema | undefined {
    return this.getData().userDetailSchema;
  }

  public getAppModelFieldType(modelType: string, fieldPath: string): string | undefined {
    const appModelFieldType = Dot.getProperty(this.getSchema(), `${modelType}.${fieldPath}.type`);

    return appModelFieldType as string | undefined;
  }

  public getModelFilterableFields(modelType: string): Set<string> {
    const modelDef = this.getSchema()[modelType];
    const filterableFields: Set<string> = new Set();

    if (!modelDef) {
      return filterableFields;
    }

    // Recursive helper to traverse nested fields
    const collectFilterableFields = (
      fields: Record<string, NexxusFieldDef>,
      prefix: string = ''
    ): void => {
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        const fieldPath = prefix ? `${prefix}.${fieldName}` : fieldName;

        if (fieldDef.type === 'object') {
          // Recurse into nested object
          collectFilterableFields(fieldDef.properties, fieldPath);
        } else if (fieldDef.type === 'array') {
          // Skip arrays entirely (not filterable)
          continue;
        } else {
          // Primitive field - check filterable flag
          if (fieldDef.filterable) {
            filterableFields.add(fieldPath);
          }
        }
      }
    };

    collectFilterableFields(modelDef);

    return filterableFields;
  }
}

