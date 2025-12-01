import { NexxusApiRequest } from "../Api";
import { InvalidParametersException } from "../Exceptions";

import { NextFunction, Response } from "express";

export default (header: string) => (req: NexxusApiRequest, res: Response, next: NextFunction) => {
  if (!req.headers[header]) {
    throw new InvalidParametersException(`Missing required header: ${header}`);
  }

  next();
};
