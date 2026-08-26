import { BodyOrgan, ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult, validateExperienceEvent } from '@siduri-y/core';
import WebSocket, { Server } from 'ws';

export type BodyState = 'idle' | 'speaking' | 'acting';

export interface Live2DAdapterConfig {
  port?: number;
  server?: Server;
  vtsUrl?: string;
  vtsPluginName?: string;
  vtsPluginDeveloper?: string;
  vtsAuthToken?: string;
}

type VtsRequest = {
  apiName: 'VTubeStudioPublicAPI';
  apiVersion: '1.0';
  requestID: string;
  messageType: string;
  data?: Record<string, unknown>;
};

export function createVtsRequest(messageType: string, data: Record<string, unknown> = {}): VtsRequest {
  return {
    apiName: 'VTubeStudioPublicAPI',
    apiVersion: '1.0',
    requestID: `siduri-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    messageType,
    data,
  };
}

export class Live2DAdapter implements BodyOrgan, ExperienceAdapter {
  readonly kind = 'avatar' as const;
  public currentExpression: string = 'neutral';
  public lastSpeechId: string | null = null;
  public lastAction: string | null = null;
  public state: BodyState = 'idle';

  private wss: Server | null = null;
  public clients: Set<WebSocket> = new Set();
  private ownServer: boolean = false;
  private vts: WebSocket | null = null;
  private vtsReady = false;
  private vtsToken: string | undefined;
  private readonly vtsConfig: Required<Pick<Live2DAdapterConfig, 'vtsPluginName' | 'vtsPluginDeveloper'>> & { url?: string };

  constructor(config: Live2DAdapterConfig = {}) {
    this.vtsConfig = {
      url: config.vtsUrl,
      vtsPluginName: config.vtsPluginName ?? 'Siduri',
      vtsPluginDeveloper: config.vtsPluginDeveloper ?? 'vxnuslabs',
    };
    this.vtsToken = config.vtsAuthToken;

    if (config.server) {
      this.wss = config.server;
    } else if (config.port) {
      this.wss = new Server({ port: config.port });
      this.ownServer = true;
    }

    if (this.wss) {
      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        
        // Send initial state upon connection
        this.sendToClient(ws, {
          type: 'lifecycle',
          event: 'connected',
          state: this.state,
          expression: this.currentExpression
        });

        ws.on('close', () => {
          this.clients.delete(ws);
        });
        ws.on('error', (err) => {
          console.error('[Live2DAdapter] WebSocket error:', err);
        });
      });
    }

    if (this.vtsConfig.url) this.connectToVtubeStudio();
  }

  async handleEvent(event: ExperienceEvent): Promise<ExperienceAdapterResult> {
    const validation = validateExperienceEvent(event);
    if (!validation.valid) {
      return {
        accepted: false,
        eventId: event?.eventId || '',
        lifecycle: 'FAILED',
        error: validation.error,
        reason: 'INVALID_EVENT_ENVELOPE',
      };
    }

    if (event.kind !== 'avatar') {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: `Body adapter received incompatible event kind: ${event.kind}`,
        reason: 'INCOMPATIBLE_EVENT_KIND',
      };
    }

    if (event.approval !== 'APPROVED') {
      return {
        accepted: false,
        eventId: event.eventId,
        lifecycle: 'FAILED',
        error: 'Event is not APPROVED',
        reason: 'APPROVAL_REQUIRED',
      };
    }

    if (event.expression) {
      this.setExpression(event.expression);
    }
    if (event.action) {
      this.act(event.action);
    }

    return {
      accepted: true,
      eventId: event.eventId,
      lifecycle: 'STARTED',
      metadata: {
        expression: this.currentExpression,
        action: this.lastAction,
        companionId: event.companionId,
        correlationId: event.correlationId,
      },
    };
  }

  private connectToVtubeStudio(): void {
    const socket = new WebSocket(this.vtsConfig.url as string);
    this.vts = socket;
    socket.on('open', () => {
      const request = this.vtsToken
        ? createVtsRequest('AuthenticationRequest', {
            pluginName: this.vtsConfig.vtsPluginName,
            pluginDeveloper: this.vtsConfig.vtsPluginDeveloper,
            authenticationToken: this.vtsToken,
          })
        : createVtsRequest('AuthenticationTokenRequest', {
            pluginName: this.vtsConfig.vtsPluginName,
            pluginDeveloper: this.vtsConfig.vtsPluginDeveloper,
          });
      socket.send(JSON.stringify(request));
    });
    socket.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString()) as {
          messageType?: string;
          data?: { authenticationToken?: string };
        };
        if (response.messageType === 'AuthenticationTokenResponse' && response.data?.authenticationToken) {
          this.vtsToken = response.data.authenticationToken;
          socket.send(JSON.stringify(createVtsRequest('AuthenticationRequest', {
            pluginName: this.vtsConfig.vtsPluginName,
            pluginDeveloper: this.vtsConfig.vtsPluginDeveloper,
            authenticationToken: this.vtsToken,
          })));
        } else if (response.messageType === 'AuthenticationResponse') {
          this.vtsReady = true;
          console.log('[Live2DAdapter] Connected to VTube Studio');
        } else if (response.messageType === 'APIError') {
          console.warn('[Live2DAdapter] VTube Studio API error:', response);
        }
      } catch (error) {
        console.warn('[Live2DAdapter] Invalid VTube Studio response:', error);
      }
    });
    socket.on('close', () => {
      this.vtsReady = false;
      this.vts = null;
    });
    socket.on('error', (error) => {
      this.vtsReady = false;
      console.warn('[Live2DAdapter] VTube Studio unavailable:', error.message);
    });
  }

  private sendToVtubeStudio(messageType: string, data: Record<string, unknown>): void {
    if (this.vtsReady && this.vts?.readyState === WebSocket.OPEN) {
      this.vts.send(JSON.stringify(createVtsRequest(messageType, data)));
    }
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  setExpression(expression: string): void {
    this.currentExpression = expression;
    if (expression.endsWith('.exp3.json')) {
      this.sendToVtubeStudio('ExpressionActivationRequest', {
        expressionFile: expression,
        fadeTime: 0.25,
        active: true,
      });
    } else {
      this.sendToVtubeStudio('HotkeyTriggerRequest', { hotkeyID: expression });
    }
    this.broadcast({
      type: 'expression',
      expression: expression,
      timestamp: Date.now()
    });
  }

  speak(speechId: string, text?: string, language?: string): void {
    this.lastSpeechId = speechId;
    this.state = 'speaking';
    this.broadcast({
      type: 'speech',
      speechId: speechId,
      text,
      language,
      state: this.state,
      timestamp: Date.now()
    });
  }

  act(action: string): void {
    this.lastAction = action;
    this.state = 'acting';
    this.sendToVtubeStudio('HotkeyTriggerRequest', { hotkeyID: action });
    this.broadcast({
      type: 'action',
      action: action,
      state: this.state,
      timestamp: Date.now()
    });
  }

  completeAction(): void {
    this.state = 'idle';
    this.broadcast({
      type: 'state_transition',
      state: this.state,
      timestamp: Date.now()
    });
  }

  cleanup(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    
    if (this.ownServer && this.wss) {
      this.wss.close();
    }
    this.vts?.close();
    this.vts = null;
    this.vtsReady = false;
    this.wss = null;
  }
}
