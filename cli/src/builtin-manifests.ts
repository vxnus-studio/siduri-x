import { OrganManifest } from './manifest';

export const BUILTIN_ORGAN_MANIFESTS: OrganManifest[] = [
  {
    name: '@siduri-x/behavior',
    organType: 'behavior',
    version: '1.0.1',
    displayName: 'Behavior (Active Self Directives)',
    description: 'Atomic directive state machine and personality projection compiler',
    entrypoint: './dist/index.js',
    factory: 'ActiveSelfCompiler',
    configKey: 'behavior',
    configSchema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['active_self', 'none']
        },
        preset: {
          type: 'string'
        }
      }
    },
    environment: [],
    services: [],
    database: null,
    healthCheck: null
  },
  {
    name: '@siduri-x/body',
    organType: 'body',
    version: '1.0.1',
    displayName: 'Body (Live2D & Avatar State)',
    description: 'Renderer-agnostic avatar expression and embodiment event adapter',
    entrypoint: './dist/index.js',
    factory: 'NeutralBodyOrgan',
    configKey: 'body',
    configSchema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['live2d', 'none']
        },
        initialExpression: {
          type: 'string',
          default: 'neutral'
        }
      }
    },
    environment: [],
    services: [],
    database: null,
    healthCheck: null
  },
  {
    name: '@siduri-x/brain',
    organType: 'brain',
    version: '1.0.1',
    displayName: 'Brain (Cognition & Planning)',
    description: 'Provider-neutral LLM reasoning, response planning, and proposal generation',
    entrypoint: './dist/index.js',
    factory: 'OpenRouterBrain',
    configKey: 'brain',
    configSchema: {
      type: 'object',
      required: ['provider', 'model'],
      properties: {
        provider: {
          type: 'string',
          enum: ['openrouter', 'openai-compatible']
        },
        model: {
          type: 'string'
        },
        apiKey: {
          type: 'string'
        },
        apiKeyEnv: {
          type: 'string',
          default: 'OPENROUTER_API_KEY'
        },
        baseUrl: {
          type: 'string'
        }
      }
    },
    environment: [
      {
        name: 'OPENROUTER_API_KEY',
        required: false,
        secret: true,
        description: 'API key for OpenRouter managed routing'
      },
      {
        name: 'OPENAI_COMPATIBLE_API_KEY',
        required: false,
        secret: true,
        description: 'API key for OpenAI-compatible endpoint'
      }
    ],
    services: [
      {
        name: 'LLM Inference API',
        kind: 'http_service',
        optional: false
      }
    ],
    database: null,
    healthCheck: 'probeBrainHealth'
  },
  {
    name: '@siduri-x/ear',
    organType: 'ear',
    version: '1.0.1',
    displayName: 'Ear (Perception Ingress)',
    description: 'Multi-modal sensory input ingestion, transcription bounds, and mime validation',
    entrypoint: './dist/index.js',
    factory: 'DefaultEarOrgan',
    configKey: 'ear',
    configSchema: {
      type: 'object',
      properties: {
        defaultSource: {
          type: 'string',
          default: 'text_chat'
        },
        maxTextLength: {
          type: 'number',
          default: 4000
        },
        maxAudioBytes: {
          type: 'number',
          default: 10485760
        }
      }
    },
    environment: [],
    services: [],
    database: null,
    healthCheck: null
  },
  {
    name: '@siduri-x/hands',
    organType: 'hands',
    version: '1.0.1',
    displayName: 'Hands (MCP Tool Execution)',
    description: 'Model Context Protocol tool management and cryptographically authorized action execution',
    entrypoint: './dist/index.js',
    factory: 'DefaultHandsOrgan',
    configKey: 'hands',
    configSchema: {
      type: 'object',
      properties: {
        defaultTimeoutMs: {
          type: 'number',
          default: 10000
        },
        providers: {
          type: 'array',
          items: {
            type: 'object',
            required: ['serverName'],
            properties: {
              serverName: {
                type: 'string'
              },
              baseUrl: {
                type: 'string'
              },
              command: {
                type: 'string'
              },
              args: {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    },
    environment: [
      {
        name: 'ACTION_POLICY_SECRET',
        required: false,
        secret: true,
        description: 'HMAC secret key for signing and verifying action execution capabilities (required in production)'
      }
    ],
    services: [],
    database: null,
    healthCheck: 'probeHandsHealth'
  },
  {
    name: '@siduri-x/knowledge',
    organType: 'knowledge',
    version: '1.0.1',
    displayName: 'Knowledge (E-Compatible Cited Facts)',
    description: 'Factual context retrieval from local or hosted E Knowledge packs',
    entrypoint: './dist/index.js',
    factory: 'EKnowledgeAdapter',
    configKey: 'knowledge',
    configSchema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['e-knowledge', 'e-remote', 'e-hub', 'none']
        },
        packPath: {
          type: 'string'
        },
        baseUrl: {
          type: 'string'
        },
        registryUrl: {
          type: 'string'
        },
        packId: {
          type: 'string'
        },
        timeoutMs: {
          type: 'number',
          default: 5000
        },
        preferredMode: {
          type: 'string',
          enum: ['lexical', 'semantic', 'hybrid'],
          default: 'lexical'
        }
      }
    },
    environment: [
      {
        name: 'SIDURI_KNOWLEDGE_PACK',
        required: false,
        secret: false,
        description: 'Path to local E knowledge pack'
      },
      {
        name: 'SIDURI_KNOWLEDGE_REGISTRY_URL',
        required: false,
        secret: false,
        default: 'https://e.vxnus.xyz/api/v1/knowledge',
        description: 'URL of the E Knowledge Hub registry'
      }
    ],
    services: [
      {
        name: 'E Knowledge Hub',
        kind: 'http_service',
        optional: true
      }
    ],
    database: null,
    healthCheck: null
  },
  {
    name: '@siduri-x/memory',
    organType: 'memory',
    version: '1.0.1',
    displayName: 'Memory (PostgreSQL FTS Claims)',
    description: 'Relational semantic claims with Full-Text Search and companion isolation',
    entrypoint: './dist/index.js',
    factory: 'PostgresMemoryOrgan',
    configKey: 'memory',
    configSchema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['postgres']
        },
        deployment: {
          type: 'string',
          enum: ['local', 'neon', 'supabase', 'other']
        },
        connectionString: {
          type: 'string'
        },
        maxConnections: {
          type: 'number',
          default: 10
        }
      }
    },
    environment: [
      {
        name: 'DATABASE_URL',
        required: true,
        secret: true,
        default: 'postgresql://postgres:postgres@localhost:5432/siduri',
        description: 'PostgreSQL connection string'
      }
    ],
    services: [
      {
        name: 'PostgreSQL Database',
        kind: 'database',
        optional: false
      }
    ],
    database: {
      engine: 'postgres',
      migrationsDir: './migrations'
    },
    healthCheck: 'probeMemoryHealth'
  },
  {
    name: '@siduri-x/observation',
    organType: 'observation',
    version: '1.0.1',
    displayName: 'Observation (Screen Perception & Frame Ingest)',
    description: 'Screen capture frame ingest, SHA-256 deduplication, and visual grounding for Eyes/Vision',
    entrypoint: './dist/index.js',
    factory: 'FixtureObservationOrgan',
    configKey: 'observation',
    configSchema: {
      type: 'object',
      properties: {}
    },
    environment: [],
    services: [],
    database: null,
    healthCheck: null
  },
  {
    name: '@siduri-x/vision',
    organType: 'vision',
    version: '1.0.1',
    displayName: 'Vision (Visual Perception & OCR)',
    description: 'Image inspection, cropping, and multi-pass OCR perception adapter',
    entrypoint: './dist/index.js',
    factory: 'OpenRouterVisionAdapter',
    configKey: 'vision',
    configSchema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['openrouter', 'none']
        },
        model: {
          type: 'string',
          default: 'gpt-4-vision'
        },
        apiKey: {
          type: 'string'
        },
        baseUrl: {
          type: 'string'
        }
      }
    },
    environment: [
      {
        name: 'OPENROUTER_API_KEY',
        required: false,
        secret: true,
        description: 'API key for vision model inference'
      }
    ],
    services: [
      {
        name: 'Vision Inference API',
        kind: 'http_service',
        optional: false
      }
    ],
    database: null,
    healthCheck: null
  },
  {
    name: '@siduri-x/voice',
    organType: 'voice',
    version: '1.0.2',
    displayName: 'Voice (VOICEVOX Speech Synthesis)',
    description: 'Queued speech synthesis and audio rendering lifecycle adapter',
    entrypoint: './dist/index.js',
    factory: 'VoicevoxAdapter',
    configKey: 'voice',
    configSchema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['voicevox', 'none']
        },
        speakerId: {
          type: 'number',
          default: 1
        },
        baseUrl: {
          type: 'string',
          default: 'http://localhost:50021'
        },
        maxQueueDepth: {
          type: 'number',
          default: 50
        },
        rvc: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: false },
            serviceUrl: { type: 'string', default: 'http://localhost:50055' },
            modelName: { type: 'string' },
            modelPath: { type: 'string' },
            indexPath: { type: 'string' },
            pitchShift: { type: 'number', default: 0 },
            f0Method: { type: 'string', enum: ['rmvpe', 'pm', 'harvest', 'crepe'], default: 'rmvpe' },
            indexRate: { type: 'number', default: 0.75 }
          }
        }
      }
    },
    environment: [
      {
        name: 'VOICEVOX_URL',
        required: false,
        secret: false,
        default: 'http://localhost:50021',
        description: 'Base URL of the running VOICEVOX engine'
      },
      {
        name: 'RVC_SERVICE_URL',
        required: false,
        secret: false,
        default: 'http://localhost:50055',
        description: 'Base URL of headless RVC voice conversion microservice'
      }
    ],
    services: [
      {
        name: 'VOICEVOX Engine',
        kind: 'http_service',
        optional: false
      },
      {
        name: 'RVC Headless Service',
        kind: 'http_service',
        optional: true
      }
    ],
    database: null,
    healthCheck: null
  }
];
