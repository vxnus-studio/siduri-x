import { Message, RequestContext, EarOrgan } from './index';

export interface NormalizedInput {
  perceivedText: string;
  sanitizedText: string;
  requestContext: RequestContext;
  role: 'OWNER' | 'VIEWER' | 'OPERATOR';
  isContextObject: boolean;
  boundedHistory: Message[];
}

/**
 * Validates raw user input, synthesizes RequestContext, normalizes history,
 * and routes input through EarOrgan if available.
 */
export async function normalizeUserInput(
  message: string,
  roleOrContext: 'OWNER' | 'VIEWER' | 'OPERATOR' | RequestContext | string = 'OWNER',
  history: Message[] = [],
  companionId: string,
  ear?: EarOrgan,
): Promise<NormalizedInput> {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
    throw new Error('message must be a non-empty string of at most 4000 characters');
  }
  if (
    !Array.isArray(history) ||
    history.length > 20 ||
    history.some(
      (item) => !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string'
    )
  ) {
    throw new Error('history must contain at most 20 user/assistant messages');
  }

  const isContextObject = typeof roleOrContext === 'object' && roleOrContext !== null;
  const role: 'OWNER' | 'VIEWER' | 'OPERATOR' = isContextObject
    ? (roleOrContext.actor.authorizationRole === 'administrator'
        ? 'OWNER'
        : (roleOrContext.actor.authorizationRole === 'operator' ? 'OPERATOR' : 'VIEWER'))
    : (roleOrContext as any);

  const requestContext: RequestContext = isContextObject
    ? roleOrContext
    : {
        companionId,
        actor: {
          actorId: role === 'OWNER' ? 'owner-user' : 'anonymous-session',
          sessionId: `sess-${companionId}`,
          authorizationRole: role === 'OWNER' ? 'administrator' : (role === 'OPERATOR' ? 'operator' : 'viewer'),
          capabilities: role === 'OWNER' ? ['chat:public', 'chat:private', 'memory:approve'] : ['chat:public'],
          authenticated: role === 'OWNER',
        },
        conversation: {
          channel: role === 'OWNER' ? 'direct' : 'public',
          audienceId: role === 'OWNER' ? 'audience-direct-owner' : 'audience-public',
          correlationId: `corr-${Date.now()}`,
        },
      };

  // Universal Perception: Route user input through EarOrgan if available
  let perceivedText = message;
  if (ear && typeof ear.listen === 'function') {
    const perception = await ear.listen('text_chat', message, {
      context: requestContext,
    });
    perceivedText = perception.text || message;
  }

  const boundedHistory = history.map((item) => ({
    role: item.role,
    content: item.content.slice(0, 2000).replace(/\0/g, ''),
  })) as Message[];

  return {
    perceivedText,
    sanitizedText: message,
    requestContext,
    role,
    isContextObject,
    boundedHistory,
  };
}
