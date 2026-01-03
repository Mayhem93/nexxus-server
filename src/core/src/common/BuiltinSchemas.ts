/**
 * Universal fields present in all models
 * Note: 'type' and 'appId' are excluded as they are handled separately in queries
 */
export const NEXXUS_UNIVERSAL_FIELDS = {
  id: { type: 'string', required: true },
  createdAt: { type: 'date', required: true },
  updatedAt: { type: 'date', required: true }
} as const;

/**
 * Schema definitions for built-in (reserved) models
 */
export const NEXXUS_BUILTIN_MODEL_SCHEMAS = {
  user: {
    username: { type: 'string', required: true },
    authProvider: { type: 'string', required: true },
    devices: { type: 'array', required: true, arrayType: 'string' }
  },
  application: {
    name: { type: 'string', required: true }
  }
} as const;

/**
 * Type helper to get valid built-in model types
 */
export type NexxusBuiltinModelType = keyof typeof NEXXUS_BUILTIN_MODEL_SCHEMAS;

/**
 * Helper to check if a model type is built-in
 */
export function isBuiltinModel(modelType: string): modelType is NexxusBuiltinModelType {
  return modelType in NEXXUS_BUILTIN_MODEL_SCHEMAS;
}
