import { NexxusBaseModel, INexxusBaseModel } from "./BaseModel";

export type NexxusAppModelType = INexxusBaseModel & {
  appId: string;
  userId?: string;
  [key: string]: any;
};

export class NexxusAppModel extends NexxusBaseModel<NexxusAppModelType> {
  constructor(props: NexxusAppModelType) {
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
