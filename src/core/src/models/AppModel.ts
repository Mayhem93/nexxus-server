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
}
