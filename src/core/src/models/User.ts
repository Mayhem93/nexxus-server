import {
  NexxusBaseModel,
  INexxusBaseModel,
  MODEL_REGISTRY
} from "./BaseModel";
import { NexxusFieldDef } from "../common/ModelTypes";
import { InvalidUserModelException } from "../lib/Exceptions";

export type NexxusUserModelType = INexxusBaseModel<'user'> & {
  appId: string;
  username: string;
  password: string | null;
  authProviders: Array<string>; // auth provider when the user was created; does not change
  devices: Array<string>; // list of device IDs associated with the user
  details?: Record<string, any>; // application specific user details
};

export interface NexxusUserDetailSchema {
  [field: string]: NexxusFieldDef;
}

export class NexxusApplicationUser extends NexxusBaseModel<NexxusUserModelType> {
  constructor(data: NexxusUserModelType) {
    super({ ...data, type: MODEL_REGISTRY.user });

    if (this.data.appId === undefined || typeof this.data.appId !== 'string') {
      throw new InvalidUserModelException("User 'appId' is required and must be a string");
    }

    if (this.data.username === undefined || typeof this.data.username !== 'string') {
      throw new InvalidUserModelException("User 'username' is required and must be a string");
    }

    if ((this.data.password !== undefined && this.data.password !== null) && typeof this.data.password !== 'string') {
      throw new InvalidUserModelException("User 'password' must be a string if provided");
    }

    if (this.data.authProviders === undefined || !Array.isArray(this.data.authProviders) || this.data.authProviders.some(ap => typeof ap !== 'string')) {
      throw new InvalidUserModelException("User 'authProviders' is required and must be an array of strings");
    }

    if (this.data.devices === undefined || !Array.isArray(this.data.devices)) {
      throw new InvalidUserModelException("User 'devices' must be an array of strings");
    } else {
      const areAllStrings = this.data.devices.every(deviceId => typeof deviceId === 'string');

      if (!areAllStrings) {
        throw new InvalidUserModelException("User 'devices' must be an array of strings");
      }
    }

    if (this.data.details !== undefined && typeof this.data.details !== 'object') {
      throw new InvalidUserModelException("User 'details' must be an object if provided");
    }
  }

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}
