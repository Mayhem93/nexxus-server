import { NexxusBaseModel, NexxusModel } from "./Model";

type NexxusApplicationModel = NexxusBaseModel & {
  type: "application";
  name: string;
  description?: string;
  ownerId: string | number;
  isActive: boolean;
};

type ApplicationConstructorParams = Pick<NexxusApplicationModel, "name" | "ownerId" | "isActive" | "description">;

export class NexxusApplication extends NexxusModel {
  constructor(data: ApplicationConstructorParams) {
    super(data as NexxusApplicationModel);
  }

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}
