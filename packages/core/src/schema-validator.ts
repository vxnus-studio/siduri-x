export class ConfigValidationError extends Error {
  public errors: string[];

  constructor(errors: string[]) {
    super(`Siduri configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

/**
 * Validates a companion configuration object against a JSON schema (draft-07 compatible).
 * Throws ConfigValidationError if validation errors are detected.
 */
export function validateCompanionConfig(config: unknown, schema: any, path: string = '$'): void {
  const errors: string[] = [];

  function validateNode(value: any, nodeSchema: any, curPath: string) {
    if (!nodeSchema || typeof nodeSchema !== 'object') return;

    // Type validation
    if (nodeSchema.type !== undefined) {
      const type = nodeSchema.type;
      if (type === 'object') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`${curPath}: expected object, received ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
          return;
        }
      } else if (type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`${curPath}: expected array, received ${typeof value}`);
          return;
        }
      } else if (type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${curPath}: expected string, received ${typeof value}`);
          return;
        }
      } else if (type === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push(`${curPath}: expected number, received ${typeof value}`);
          return;
        }
      } else if (type === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          errors.push(`${curPath}: expected integer, received ${typeof value}`);
          return;
        }
      } else if (type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(`${curPath}: expected boolean, received ${typeof value}`);
          return;
        }
      }
    }

    // Enum validation
    if (Array.isArray(nodeSchema.enum)) {
      if (!nodeSchema.enum.includes(value)) {
        errors.push(
          `${curPath}: invalid value ${JSON.stringify(value)}, expected one of: ${nodeSchema.enum.map((v: any) => JSON.stringify(v)).join(', ')}`
        );
        return;
      }
    }

    // Object properties validation
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (Array.isArray(nodeSchema.required)) {
        for (const reqKey of nodeSchema.required) {
          if (value[reqKey] === undefined) {
            errors.push(`${curPath}.${reqKey}: is required`);
          }
        }
      }

      const definedProps = nodeSchema.properties || {};

      if (nodeSchema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          // Allow $schema property at root level
          if (curPath === '$' && key === '$schema') continue;
          if (!(key in definedProps)) {
            errors.push(`${curPath}.${key}: unexpected property is not allowed`);
          }
        }
      }

      for (const [propName, propSchema] of Object.entries(definedProps)) {
        if (value[propName] !== undefined) {
          validateNode(value[propName], propSchema, `${curPath}.${propName}`);
        }
      }
    }

    // Array items validation
    if (Array.isArray(value) && nodeSchema.items) {
      value.forEach((item, index) => {
        validateNode(item, nodeSchema.items, `${curPath}[${index}]`);
      });
    }
  }

  validateNode(config, schema, path);

  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
}
