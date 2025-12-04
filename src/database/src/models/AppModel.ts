import { NexxusBaseModel, INexxusBaseModel } from "./BaseModel";

export interface NexxusAppModelProps extends INexxusBaseModel {
  appId: string;
  // All other fields are dynamic
  [key: string]: any;
}

export class NexxusAppModel extends NexxusBaseModel<NexxusAppModelProps> {
  constructor(props: NexxusAppModelProps) {
    super(props);

    // Validate required field
    if (!props.appId) {
      throw new Error('AppModel requires appId');
    }
  }

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}
