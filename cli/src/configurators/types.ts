import { OrganManifest } from '../manifest';

export interface OrganConfigurationResult {
  config: Record<string, unknown>;
  summary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface OrganConfiguratorContext {
  companionName: string;
  manifest: OrganManifest;
  existingConfig?: Record<string, unknown>;
}

export type OrganConfigurator = (context: OrganConfiguratorContext) => Promise<OrganConfigurationResult>;
