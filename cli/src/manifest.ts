export interface OrganEnvironmentVar {
  name: string;
  required?: boolean;
  secret?: boolean;
  default?: string;
  description?: string;
}

export interface OrganServiceRequirement {
  name: string;
  kind: 'database' | 'http_service' | 'process' | string;
  optional?: boolean;
  description?: string;
}

export interface OrganDatabaseRequirement {
  engine: 'postgres' | 'sqlite' | string;
  migrationsDir?: string;
}

export interface OrganManifest {
  name: string;
  organType: string;
  version: string;
  displayName: string;
  description?: string;
  entrypoint: string;
  factory: string;
  configKey: string;
  configSchema: Record<string, any>;
  environment: OrganEnvironmentVar[];
  services: OrganServiceRequirement[];
  database?: OrganDatabaseRequirement | null;
  healthCheck?: string | null;
}

export function validateOrganManifest(manifest: unknown, sourcePath?: string): OrganManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Invalid manifest at ${sourcePath || 'unknown'}: expected an object`);
  }
  const m = manifest as Partial<OrganManifest>;
  if (!m.name || typeof m.name !== 'string' || !m.name.startsWith('@siduri-x/')) {
    throw new Error(`Invalid manifest name in ${sourcePath || 'unknown'}: expected package name starting with @siduri-x/`);
  }
  if (!m.organType || typeof m.organType !== 'string') {
    throw new Error(`Invalid manifest organType in ${sourcePath || m.name}`);
  }
  if (!m.version || typeof m.version !== 'string') {
    throw new Error(`Invalid manifest version in ${sourcePath || m.name}`);
  }
  if (!m.displayName || typeof m.displayName !== 'string') {
    throw new Error(`Invalid manifest displayName in ${sourcePath || m.name}`);
  }
  if (!m.entrypoint || typeof m.entrypoint !== 'string') {
    throw new Error(`Invalid manifest entrypoint in ${sourcePath || m.name}`);
  }
  if (!m.factory || typeof m.factory !== 'string') {
    throw new Error(`Invalid manifest factory in ${sourcePath || m.name}`);
  }
  if (!m.configKey || typeof m.configKey !== 'string') {
    throw new Error(`Invalid manifest configKey in ${sourcePath || m.name}`);
  }
  if (!m.configSchema || typeof m.configSchema !== 'object') {
    throw new Error(`Invalid manifest configSchema in ${sourcePath || m.name}`);
  }
  if (!Array.isArray(m.environment)) {
    throw new Error(`Invalid manifest environment in ${sourcePath || m.name}: expected array`);
  }
  if (!Array.isArray(m.services)) {
    throw new Error(`Invalid manifest services in ${sourcePath || m.name}: expected array`);
  }

  return m as OrganManifest;
}
