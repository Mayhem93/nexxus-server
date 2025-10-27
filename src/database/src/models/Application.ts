import { NexxusBaseModel, NexxusModel } from "./Model";

type NexxusApplicationModel = NexxusBaseModel & {
  name: string;
  description?: string;
  ownerId: string | number;
  isActive: boolean;
};

export class NexxusApplication extends NexxusModel {
  constructor(data: NexxusApplicationModel) {
    super(data);
  }

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}
