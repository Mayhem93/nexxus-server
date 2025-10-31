import { NexxusBaseModelType, NexxusBaseModel } from "./Model";

type NexxusApplicationModelType = NexxusBaseModelType & {
  type: "application";
  name: string;
  description?: string;
  ownerId: string | number;
  isActive: boolean
};

type ApplicationConstructorParams = Pick<NexxusApplicationModelType, "name" | "ownerId" | "isActive" | "description">;

export class NexxusApplication extends NexxusBaseModel {
  constructor(data: ApplicationConstructorParams) {
    super(data as NexxusApplicationModelType);
  }

  async save(): Promise<void> {
    // Implementation for saving the application model to the database
  }

  async delete(): Promise<void> {
    // Implementation for deleting the application model from the database
  }
}
