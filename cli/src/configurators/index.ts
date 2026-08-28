import { OrganManifest } from '../manifest';
import { OrganConfigurationResult, OrganConfiguratorContext } from './types';
import { configureBrain, BrainConfiguratorOptions } from './brain';
import { configureKnowledge, KnowledgeConfiguratorOptions } from './knowledge';
import { configureMemory } from './memory';
import { configureVoice } from './voice';
import { configureBody } from './body';
import { configureHands } from './hands';
import { configureBehavior } from './behavior';
import { configureVision } from './vision';
import { configureEar } from './ear';
import { configureObservation } from './observation';

export * from './types';
export * from './brain';
export * from './knowledge';
export * from './memory';
export * from './voice';
export * from './body';
export * from './hands';
export * from './behavior';
export * from './vision';
export * from './ear';
export * from './observation';

export interface ConfigureOrganOptions {
  brainOptions?: BrainConfiguratorOptions;
  knowledgeOptions?: KnowledgeConfiguratorOptions;
}

export async function configureOrgan(
  manifest: OrganManifest,
  context: { companionName: string; existingConfig?: Record<string, unknown> },
  options: ConfigureOrganOptions = {}
): Promise<OrganConfigurationResult> {
  const ctx: OrganConfiguratorContext = {
    companionName: context.companionName,
    manifest,
    existingConfig: context.existingConfig,
  };

  switch (manifest.organType) {
    case 'brain':
      return configureBrain(ctx, options.brainOptions);
    case 'knowledge':
      return configureKnowledge(ctx, options.knowledgeOptions);
    case 'memory':
      return configureMemory(ctx);
    case 'voice':
      return configureVoice(ctx);
    case 'body':
      return configureBody(ctx);
    case 'hands':
      return configureHands(ctx);
    case 'behavior':
      return configureBehavior(ctx);
    case 'vision':
      return configureVision(ctx);
    case 'ear':
      return configureEar(ctx);
    case 'observation':
      return configureObservation(ctx);
    default:
      return {
        config: ctx.existingConfig || {},
        summary: {
          Provider: manifest.displayName,
        },
      };
  }
}
