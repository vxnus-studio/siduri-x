import { validateCompanionConfig, ConfigValidationError } from './schema-validator';

describe('validateCompanionConfig', () => {
  const sampleSchema = {
    type: 'object',
    required: ['id', 'name', 'organs'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      id: { type: 'string' },
      name: { type: 'string' },
      organs: {
        type: 'object',
        additionalProperties: false,
        properties: {
          brain: {
            type: 'object',
            required: ['provider', 'model'],
            properties: {
              provider: {
                type: 'string',
                enum: ['openrouter', 'openai-compatible'],
              },
              model: { type: 'string' },
            },
          },
          memory: {
            type: 'object',
            required: ['provider'],
            properties: {
              provider: {
                type: 'string',
                enum: ['sqlite', 'in-memory', 'none'],
              },
              maxConnections: { type: 'number' },
            },
          },
        },
      },
    },
  };

  test('accepts valid configuration matching schema', () => {
    const validConfig = {
      $schema: './siduri.schema.json',
      id: 'companion-1',
      name: 'Test Companion',
      organs: {
        brain: {
          provider: 'openrouter',
          model: 'gpt-4o',
        },
      },
    };

    expect(() => validateCompanionConfig(validConfig, sampleSchema)).not.toThrow();
  });

  test('throws ConfigValidationError if missing required root field', () => {
    const invalidConfig = {
      name: 'Missing Id and Organs',
    };

    expect(() => validateCompanionConfig(invalidConfig, sampleSchema)).toThrow(ConfigValidationError);
    try {
      validateCompanionConfig(invalidConfig, sampleSchema);
    } catch (err: any) {
      expect(err.errors).toContain('$.id: is required');
      expect(err.errors).toContain('$.organs: is required');
    }
  });

  test('throws ConfigValidationError on unexpected property when additionalProperties is false', () => {
    const invalidConfig = {
      id: 'c-1',
      name: 'Test',
      organs: {},
      extraField: 'not allowed',
    };

    expect(() => validateCompanionConfig(invalidConfig, sampleSchema)).toThrow(ConfigValidationError);
    try {
      validateCompanionConfig(invalidConfig, sampleSchema);
    } catch (err: any) {
      expect(err.errors).toContain('$.extraField: unexpected property is not allowed');
    }
  });

  test('throws ConfigValidationError on invalid enum value', () => {
    const invalidConfig = {
      id: 'c-1',
      name: 'Test',
      organs: {
        brain: {
          provider: 'invalid-brain-provider',
          model: 'gpt-4',
        },
      },
    };

    expect(() => validateCompanionConfig(invalidConfig, sampleSchema)).toThrow(ConfigValidationError);
    try {
      validateCompanionConfig(invalidConfig, sampleSchema);
    } catch (err: any) {
      expect(err.errors.some((e: string) => e.includes('invalid value "invalid-brain-provider"'))).toBe(true);
    }
  });

  test('throws ConfigValidationError on invalid type', () => {
    const invalidConfig = {
      id: 12345, // should be string
      name: 'Test',
      organs: {
        memory: {
          provider: 'sqlite',
          maxConnections: 'ten', // should be number
        },
      },
    };

    expect(() => validateCompanionConfig(invalidConfig, sampleSchema)).toThrow(ConfigValidationError);
    try {
      validateCompanionConfig(invalidConfig, sampleSchema);
    } catch (err: any) {
      expect(err.errors).toContain('$.id: expected string, received number');
      expect(err.errors).toContain('$.organs.memory.maxConnections: expected number, received string');
    }
  });
});
