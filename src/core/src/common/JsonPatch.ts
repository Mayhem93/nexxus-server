import {
  NexxusApplicationSchema,
  NexxusFieldDef,
  NexxusModelDef,
  NexxusObjectFieldDef,
  NexxusArrayFieldDef,
  NexxusModelPrimitiveType
} from '../models/Application';
import { InvalidJsonPatchException } from '../lib/Exceptions';

const JSON_OPS = ['replace'] as const;

export type NexxusJsonPatchType = {
  op: typeof JSON_OPS[number],
  path: string[], // as opposed to the JSONPatch standard, we are using "." for path separation instead of "/"
  value: any[],
  metadata: NexxusJsonPatchMetadata
};

export type NexxusJsonPatchMetadata = {
  appId: string;
  id: string;
  type: string;
};

export class NexxusJsonPatch {
  private valid: boolean = false;

  constructor(private fullPatch: NexxusJsonPatchType) {
    if (!fullPatch || typeof fullPatch !== 'object' || Array.isArray(fullPatch)) {
      throw new InvalidJsonPatchException(`Invalid patch format`);
    }
    if (!JSON_OPS.includes(fullPatch.op)) {
      throw new InvalidJsonPatchException(`Unsupported JSON Patch operation: ${fullPatch.op}`);
    }

    if (fullPatch.path.length !== fullPatch.value.length) {
      throw new InvalidJsonPatchException(`Path and value arrays must have the same length`);
    }

    if (!fullPatch.metadata.type || typeof fullPatch.metadata.type !== 'string') {
      throw new InvalidJsonPatchException(`Patch metadata must include modelType`);
    }

    if (!fullPatch.metadata.appId || typeof fullPatch.metadata.appId !== 'string') {
      throw new InvalidJsonPatchException(`Patch metadata must include appId`);
    }

    if (!fullPatch.metadata.id || typeof fullPatch.metadata.id !== 'string') {
      throw new InvalidJsonPatchException(`Patch metadata must include id`);
    }
  }

  public get(): NexxusJsonPatchType {
    return this.fullPatch;
  }

  public isValid(): boolean {
    return this.valid;
  }

  public validate(appSchema: NexxusApplicationSchema): void {
    const modelSpec = appSchema[this.fullPatch.metadata.type];

    if (!modelSpec) {
      throw new InvalidJsonPatchException(`Model type ${this.fullPatch.metadata.type} not found in application schema`);
    }

    // Validate each path/value pair
    for (let i = 0; i < this.fullPatch.path.length; i++) {
      const currentPath = this.fullPatch.path[i];
      const currentValue = this.fullPatch.value[i];

      // Find field definition in schema
      const fieldDef = NexxusJsonPatch.traverseSchema(modelSpec, currentPath);

      if (!fieldDef) {
        throw new InvalidJsonPatchException(
          `Path "${currentPath}" does not exist in model "${this.fullPatch.metadata.type}"`
        );
      }

      // Recursively validate value matches field type
      if (!NexxusJsonPatch.validateValueType(currentValue, fieldDef, currentPath)) {
        throw new InvalidJsonPatchException(
          `Value at path "${currentPath}" has invalid type`
        );
      }
    }

    this.valid = true;
  }

  private static traverseSchema(
    schema: NexxusModelDef,
    path: string
  ): NexxusFieldDef | null {
    const parts = path.split('.');
    let current: NexxusModelDef | Record<string, NexxusFieldDef> = schema;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!(part in current)) {
        return null;
      }

      const fieldDef = current[part];

      // If this is the last part, return the field definition
      if (i === parts.length - 1) {
        return fieldDef;
      }

      // Navigate into nested structure
      if (fieldDef.type === 'object') {
        const objDef = fieldDef as NexxusObjectFieldDef;

        current = objDef.properties;
      } else if (fieldDef.type === 'array') {
        const arrDef = fieldDef as NexxusArrayFieldDef;

        // For arrays of objects, traverse into the object properties
        if (arrDef.arrayType === 'object' && 'properties' in arrDef) {
          current = (arrDef as any).properties;
        } else {
          // Can't traverse further into primitive arrays
          return null;
        }
      } else {
        // Can't traverse into primitive types
        return null;
      }
    }

    return null;
  }

  private static validateValueType(
    value: any,
    fieldDef: NexxusFieldDef,
    path: string
  ): boolean {
    const { type } = fieldDef;

    switch (type) {
      case 'string':
        return this.validateString(value, path);

      case 'number':
        return this.validateNumber(value, path);

      case 'boolean':
        return this.validateBoolean(value, path);

      case 'date':
        return this.validateDate(value, path);

      case 'object':
        return this.validateObject(value, fieldDef, path);

      case 'array':
        return this.validateArray(value, fieldDef, path);

      default:
        throw new InvalidJsonPatchException(`Unknown field type "${type}" at path "${path}"`);
    }
  }

  /**
 * Validate string type
 */
  private static validateString(value: any, path: string): boolean {
    if (typeof value !== 'string') {
      throw new InvalidJsonPatchException(`Value at path "${path}" must be a string`);
    }
    return true;
  }

  /**
   * Validate number type
   */
  private static validateNumber(value: any, path: string): boolean {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new InvalidJsonPatchException(`Value at path "${path}" must be a number`);
    }
    return true;
  }

  /**
   * Validate boolean type
   */
  private static validateBoolean(value: any, path: string): boolean {
    if (typeof value !== 'boolean') {
      throw new InvalidJsonPatchException(`Value at path "${path}" must be a boolean`);
    }
    return true;
  }

  /**
   * Validate date type
   */
  private static validateDate(value: any, path: string): boolean {
    const isValid = value instanceof Date ||
      (typeof value === 'string' && !isNaN(Date.parse(value)));

    if (!isValid) {
      throw new InvalidJsonPatchException(`Value at path "${path}" must be a valid date`);
    }
    return true;
  }

  /**
   * Validate object type (recursively validates properties)
   */
  private static validateObject(
    value: any,
    fieldDef: NexxusObjectFieldDef,
    path: string
  ): boolean {
    // Basic type check
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new InvalidJsonPatchException(`Value at path "${path}" must be an object`);
    }

    // Recursively validate each property
    for (const key in value) {
      const nestedFieldDef = fieldDef.properties[key];

      if (!nestedFieldDef) {
        throw new InvalidJsonPatchException(`Unknown property "${key}" in object at path "${path}"`);
      }

      const nestedPath = path ? `${path}.${key}` : key;
      this.validateValueType(value[key], nestedFieldDef, nestedPath);
    }

    return true;
  }

  /**
 * Validate array type (recursively validates elements)
 */
  private static validateArray(
    value: any,
    fieldDef: NexxusArrayFieldDef,
    path: string
  ): boolean {
    // Basic type check
    if (!Array.isArray(value)) {
      throw new InvalidJsonPatchException(`Value at path "${path}" must be an array`);
    }

    const { arrayType } = fieldDef;

    // Validate each element based on arrayType
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;

      if (arrayType === 'object') {
        // Leverage validateObject for objects in arrays
        const objDef = fieldDef as any; // Has properties field
        this.validateObject(item, objDef, itemPath);
      } else {
        // For primitive types, use the primitive validator
        this.validatePrimitiveType(item, arrayType, itemPath);
      }
    });

    return true;
  }

  /**
 * Helper to validate primitive types (reusable for arrays)
 */
  private static validatePrimitiveType(
    value: any,
    type: NexxusModelPrimitiveType,
    path: string
  ): boolean {
    switch (type) {
      case 'string':
        return this.validateString(value, path);
      case 'number':
        return this.validateNumber(value, path);
      case 'boolean':
        return this.validateBoolean(value, path);
      case 'date':
        return this.validateDate(value, path);
    }
  }
}
