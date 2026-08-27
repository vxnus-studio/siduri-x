export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeAndCheckForbiddenKeys(val: unknown, path: string = ''): string[] {
  const errors: string[] = [];
  if (val && typeof val === 'object') {
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        errors.push(...sanitizeAndCheckForbiddenKeys(val[i], `${path}[${i}]`));
      }
    } else {
      const rec = val as Record<string, unknown>;
      // Check own properties and symbol/special names
      const ownKeys = Object.getOwnPropertyNames(rec);
      for (const key of ownKeys) {
        if (FORBIDDEN_KEYS.has(key)) {
          errors.push(`Forbidden prototype pollution key "${key}" detected at path "${path ? path + '.' + key : key}"`);
        }
        errors.push(...sanitizeAndCheckForbiddenKeys(rec[key], path ? `${path}.${key}` : key));
      }

      // Check constructor or prototype property references
      if (Object.prototype.hasOwnProperty.call(rec, 'constructor')) {
        errors.push(`Forbidden prototype pollution key "constructor" detected at path "${path ? path + '.constructor' : 'constructor'}"`);
      }
      if (Object.prototype.hasOwnProperty.call(rec, '__proto__')) {
        errors.push(`Forbidden prototype pollution key "__proto__" detected at path "${path ? path + '.__proto__' : '__proto__'}"`);
      }
      if (Object.prototype.hasOwnProperty.call(rec, 'prototype')) {
        errors.push(`Forbidden prototype pollution key "prototype" detected at path "${path ? path + '.prototype' : 'prototype'}"`);
      }
    }
  }
  return errors;
}

export function validateInputSchema(
  schema: Record<string, unknown> | undefined,
  params: Record<string, unknown> | undefined,
  currentPath: string = ''
): SchemaValidationResult {
  // Always inspect for prototype pollution keys recursively
  const forbiddenKeyErrors = sanitizeAndCheckForbiddenKeys(params, currentPath);
  if (forbiddenKeyErrors.length > 0) {
    return { valid: false, errors: forbiddenKeyErrors };
  }

  if (!schema || Object.keys(schema).length === 0) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];
  const parameters = params ?? {};

  // Check type of parameters
  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    return { valid: false, errors: [`Parameter at "${currentPath || 'root'}" must be a JSON object`] };
  }

  // 1. Required fields
  if (Array.isArray(schema.required)) {
    for (const reqField of schema.required) {
      if (typeof reqField === 'string') {
        if (parameters[reqField] === undefined || parameters[reqField] === null) {
          const fieldPath = currentPath ? `${currentPath}.${reqField}` : reqField;
          errors.push(`Missing required parameter "${fieldPath}"`);
        }
      }
    }
  }

  // 2. Recursive properties type checking
  const properties = schema.properties as Record<string, any> | undefined;
  if (properties && typeof properties === 'object') {
    for (const [propName, propSchema] of Object.entries(properties)) {
      const fieldPath = currentPath ? `${currentPath}.${propName}` : propName;
      const val = parameters[propName];

      if (val !== undefined && val !== null && propSchema && typeof propSchema === 'object') {
        const expectedType = propSchema.type;
        if (expectedType) {
          if (expectedType === 'string' && typeof val !== 'string') {
            errors.push(`Parameter "${fieldPath}" expected type string, got ${typeof val}`);
          } else if (expectedType === 'number' && (typeof val !== 'number' || isNaN(val))) {
            errors.push(`Parameter "${fieldPath}" expected type number, got ${typeof val}`);
          } else if (expectedType === 'boolean' && typeof val !== 'boolean') {
            errors.push(`Parameter "${fieldPath}" expected type boolean, got ${typeof val}`);
          } else if (expectedType === 'array') {
            if (!Array.isArray(val)) {
              errors.push(`Parameter "${fieldPath}" expected type array, got ${typeof val}`);
            } else if (propSchema.items && typeof propSchema.items === 'object') {
              // Recursive array item validation
              for (let i = 0; i < val.length; i++) {
                const itemPath = `${fieldPath}[${i}]`;
                const itemVal = val[i];
                const itemType = propSchema.items.type;

                if (itemType === 'object' || (propSchema.items.properties && typeof itemVal === 'object')) {
                  const nestedRes = validateInputSchema(propSchema.items, itemVal, itemPath);
                  if (!nestedRes.valid) {
                    errors.push(...nestedRes.errors);
                  }
                } else if (itemType && typeof itemVal !== itemType) {
                  errors.push(`Parameter "${itemPath}" expected type ${itemType}, got ${typeof itemVal}`);
                }
              }
            }
          } else if (expectedType === 'object') {
            if (typeof val !== 'object' || Array.isArray(val)) {
              errors.push(`Parameter "${fieldPath}" expected type object, got ${typeof val}`);
            } else {
              // Recursive nested object validation
              const nestedRes = validateInputSchema(propSchema, val as Record<string, unknown>, fieldPath);
              if (!nestedRes.valid) {
                errors.push(...nestedRes.errors);
              }
            }
          }
        }

        // Enum checking
        if (Array.isArray(propSchema.enum)) {
          if (!propSchema.enum.includes(val)) {
            errors.push(
              `Parameter "${fieldPath}" has invalid value "${val}". Must be one of: [${propSchema.enum.join(', ')}]`
            );
          }
        }
      }
    }

    // additionalProperties restriction
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(parameters)) {
        if (!properties[key]) {
          const extraPath = currentPath ? `${currentPath}.${key}` : key;
          errors.push(`Unexpected additional parameter "${extraPath}"`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
