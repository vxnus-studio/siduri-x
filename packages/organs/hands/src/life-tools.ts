import { ToolDefinition } from '@siduri-x/core';
import { ToolHandler } from './index';

export interface LifeToolsOptions {
  companionId?: string;
}

/**
 * Creates audited action tool handlers for mutating the sovereign Life Database
 * in accordance with Siduri-X Action Policy and Truth Gate governance.
 */
export function createLifeTools(knowledge: any, options: LifeToolsOptions = {}): ToolHandler[] {
  const getCompId = (params: Record<string, unknown>): string => {
    return (params.companionId as string) || options.companionId || 'default';
  };

  const handlers: ToolHandler[] = [];

  // 1. life:save_entity
  const saveEntityDef: ToolDefinition = {
    name: 'life:save_entity',
    providerId: 'life',
    description: 'Create or update an entity (item, contact, place, preference, hardware) in the sovereign Life DB',
    riskLevel: 'LOW',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional unique entity ID' },
        companionId: { type: 'string', description: 'Optional companion ID' },
        name: { type: 'string', description: 'Entity name' },
        entityType: { type: 'string', description: 'Entity type (e.g. inventory, contact, place, hardware)' },
        domain: { type: 'string', description: 'Domain (e.g. gaming, work, personal, social)' },
        properties: { type: 'object', description: 'Arbitrary entity properties/metadata' },
      },
      required: ['name'],
    },
  };

  const saveEntityHandler: ToolHandler = {
    definition: saveEntityDef,
    execute: async (parameters: Record<string, unknown>, _signal?: AbortSignal) => {
      const compId = getCompId(parameters);
      const name = String(parameters.name || 'Unnamed');
      const entityType = String(parameters.entityType || 'entity');
      const domain = String(parameters.domain || 'general');
      const properties = (parameters.properties as Record<string, unknown>) || {};
      const id = (parameters.id as string) || `ent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (knowledge.entities && typeof knowledge.entities.saveEntity === 'function') {
        await knowledge.entities.saveEntity({
          id,
          companionId: compId,
          entityType,
          domain,
          name,
          properties,
          updatedAt: new Date().toISOString(),
        });
        return { success: true, id, entityType, name, domain };
      } else if (knowledge.inventory && typeof knowledge.inventory.saveItem === 'function') {
        await knowledge.inventory.saveItem({
          id,
          companionId: compId,
          domain,
          entityName: name,
          properties,
          updatedAt: new Date().toISOString(),
        });
        return { success: true, id, name, domain };
      }

      throw new Error('Knowledge organ does not support saving entities or inventory');
    },
  };
  handlers.push(saveEntityHandler);

  // 2. life:log_event
  const logEventDef: ToolDefinition = {
    name: 'life:log_event',
    providerId: 'life',
    description: 'Log an event or metric to the sovereign Life DB time-series stream (finance, health, workout, habit)',
    riskLevel: 'LOW',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional unique event ID' },
        companionId: { type: 'string', description: 'Optional companion ID' },
        stream: { type: 'string', description: 'Event stream name (finance, health, workout, habit, sleep)' },
        metricValue: { type: 'number', description: 'Numerical metric (dollar amount, duration, weight, distance)' },
        metadata: { type: 'object', description: 'Context metadata (category, currency, unit, notes)' },
      },
      required: ['stream'],
    },
  };

  const logEventHandler: ToolHandler = {
    definition: logEventDef,
    execute: async (parameters: Record<string, unknown>, _signal?: AbortSignal) => {
      const compId = getCompId(parameters);
      const stream = String(parameters.stream || 'telemetry');
      const metricValue = typeof parameters.metricValue === 'number' ? parameters.metricValue : undefined;
      const metadata = (parameters.metadata as Record<string, unknown>) || {};
      const id = (parameters.id as string) || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = (parameters.timestamp as string) || new Date().toISOString();

      if (knowledge.events && typeof knowledge.events.addEvent === 'function') {
        await knowledge.events.addEvent({
          id,
          companionId: compId,
          stream,
          timestamp,
          metricValue,
          metadata,
        });
        return { success: true, id, stream, metricValue, timestamp };
      } else if (stream === 'finance' && knowledge.finance && typeof knowledge.finance.addEntry === 'function') {
        await knowledge.finance.addEntry({
          id,
          companionId: compId,
          category: (metadata.category as string) || 'general',
          amount: metricValue || 0,
          currency: (metadata.currency as string) || 'USD',
          timestamp,
          metadata,
        });
        return { success: true, id, stream: 'finance', amount: metricValue };
      }

      throw new Error('Knowledge organ does not support event logging');
    },
  };
  handlers.push(logEventHandler);

  // 3. life:upsert_schedule
  const upsertScheduleDef: ToolDefinition = {
    name: 'life:upsert_schedule',
    providerId: 'life',
    description: 'Add or update a schedule event or commitment in the sovereign Life DB',
    riskLevel: 'LOW',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional unique schedule item ID' },
        companionId: { type: 'string', description: 'Optional companion ID' },
        title: { type: 'string', description: 'Event title' },
        startTime: { type: 'string', description: 'Start time in ISO format' },
        endTime: { type: 'string', description: 'Optional end time in ISO format' },
        isRecurring: { type: 'boolean', description: 'Whether the event recurs' },
        status: { type: 'string', description: 'Status (e.g. active, completed, cancelled)' },
      },
      required: ['title', 'startTime'],
    },
  };

  const upsertScheduleHandler: ToolHandler = {
    definition: upsertScheduleDef,
    execute: async (parameters: Record<string, unknown>, _signal?: AbortSignal) => {
      const compId = getCompId(parameters);
      const title = String(parameters.title || 'Untitled Event');
      const startTime = String(parameters.startTime || new Date().toISOString());
      const endTime = parameters.endTime ? String(parameters.endTime) : undefined;
      const isRecurring = Boolean(parameters.isRecurring);
      const status = String(parameters.status || 'active');
      const id = (parameters.id as string) || `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (knowledge.schedule && typeof knowledge.schedule.saveItem === 'function') {
        await knowledge.schedule.saveItem({
          id,
          companionId: compId,
          title,
          startTime,
          endTime,
          isRecurring,
          status,
        });
        return { success: true, id, title, startTime, status };
      }

      throw new Error('Knowledge organ does not support schedule management');
    },
  };
  handlers.push(upsertScheduleHandler);

  // 4. life:update_task
  const updateTaskDef: ToolDefinition = {
    name: 'life:update_task',
    providerId: 'life',
    description: 'Add, update, or complete a task, to-do, or goal in the sovereign Life DB',
    riskLevel: 'LOW',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional unique task ID' },
        companionId: { type: 'string', description: 'Optional companion ID' },
        title: { type: 'string', description: 'Task title or goal description' },
        status: { type: 'string', description: 'Status (backlog, in_progress, completed, cancelled)' },
        priority: { type: 'number', description: 'Priority rank' },
        targetDate: { type: 'string', description: 'Optional target due date' },
        metadata: { type: 'object', description: 'Optional metadata' },
      },
      required: ['title'],
    },
  };

  const updateTaskHandler: ToolHandler = {
    definition: updateTaskDef,
    execute: async (parameters: Record<string, unknown>, _signal?: AbortSignal) => {
      const compId = getCompId(parameters);
      const title = String(parameters.title || 'Untitled Task');
      const status = String(parameters.status || 'backlog');
      const priority = typeof parameters.priority === 'number' ? parameters.priority : 0;
      const targetDate = parameters.targetDate ? String(parameters.targetDate) : undefined;
      const metadata = (parameters.metadata as Record<string, unknown>) || undefined;
      const id = (parameters.id as string) || `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (knowledge.tasks && typeof knowledge.tasks.saveTask === 'function') {
        await knowledge.tasks.saveTask({
          id,
          companionId: compId,
          title,
          status,
          priority,
          targetDate,
          metadata,
          updatedAt: new Date().toISOString(),
        });
        return { success: true, id, title, status, priority };
      }

      throw new Error('Knowledge organ does not support task management');
    },
  };
  handlers.push(updateTaskHandler);

  return handlers;
}
