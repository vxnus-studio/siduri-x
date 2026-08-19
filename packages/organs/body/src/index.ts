import { BodyOrgan } from '@siduri-y/core';
import WebSocket, { Server } from 'ws';

export type BodyState = 'idle' | 'speaking' | 'acting';

export interface Live2DAdapterConfig {
  port?: number;
  server?: Server;
}

export class Live2DAdapter implements BodyOrgan {
  public currentExpression: string = 'neutral';
  public lastSpeechId: string | null = null;
  public lastAction: string | null = null;
  public state: BodyState = 'idle';

  private wss: Server | null = null;
  public clients: Set<WebSocket> = new Set();
  private ownServer: boolean = false;

  constructor(config: Live2DAdapterConfig = {}) {
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
    this.broadcast({
      type: 'expression',
      expression: expression,
      timestamp: Date.now()
    });
  }

  speak(speechId: string): void {
    this.lastSpeechId = speechId;
    this.state = 'speaking';
    this.broadcast({
      type: 'speech',
      speechId: speechId,
      state: this.state,
      timestamp: Date.now()
    });
  }

  act(action: string): void {
    this.lastAction = action;
    this.state = 'acting';
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
    this.wss = null;
  }
}
