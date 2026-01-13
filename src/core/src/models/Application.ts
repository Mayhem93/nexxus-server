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

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}

