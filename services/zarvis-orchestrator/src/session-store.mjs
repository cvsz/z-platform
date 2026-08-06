import { createReadStream } from 'node:fs';
import {
  link,
  mkdir,
  readFile,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeCommandId, normalizeSessionId } from './contracts.mjs';

const MAX_RESULT_BYTES = 1024 * 1024;
const MAX_EVENT_BYTES = 64 * 1024;

function jsonLine(value) {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > MAX_EVENT_BYTES) {
    throw new Error(`Session event exceeds ${MAX_EVENT_BYTES} bytes.`);
  }
  return `${serialized}\n`;
}

function isNotFound(error) {
  return error?.code === 'ENOENT';
}

function safeResultEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Stored command result envelope is invalid.');
  }
  if (typeof value.fingerprint !== 'string' || !value.result || typeof value.result !== 'object') {
    throw new Error('Stored command result envelope is invalid.');
  }
  return value;
}

export class FileSessionStore {
  constructor({ rootDir = process.env.ZARVIS_DATA_DIR ?? './data/zarvis' } = {}) {
    this.rootDir = resolve(rootDir);
    this.sessionsDir = resolve(this.rootDir, 'sessions');
    this.commandsDir = resolve(this.rootDir, 'commands');
    this.writeChains = new Map();
  }

  async ensureDirectories() {
    await Promise.all([
      mkdir(this.sessionsDir, { recursive: true, mode: 0o700 }),
      mkdir(this.commandsDir, { recursive: true, mode: 0o700 }),
    ]);
  }

  sessionPath(sessionId) {
    return resolve(this.sessionsDir, `${normalizeSessionId(sessionId)}.jsonl`);
  }

  commandPath(commandId) {
    return resolve(this.commandsDir, `${normalizeCommandId(commandId)}.json`);
  }

  async appendEvent(event) {
    const sessionId = normalizeSessionId(event?.session_id);
    const line = jsonLine(event);
    await this.ensureDirectories();

    const previous = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(async () => {
      await writeFile(this.sessionPath(sessionId), line, {
        encoding: 'utf8',
        flag: 'a',
        mode: 0o600,
      });
    });
    const guarded = next.catch(() => {});
    this.writeChains.set(sessionId, guarded);
    try {
      await next;
    } finally {
      if (this.writeChains.get(sessionId) === guarded) this.writeChains.delete(sessionId);
    }
  }

  async getCommandResult(commandId) {
    const path = this.commandPath(commandId);
    try {
      const file = await readFile(path, 'utf8');
      if (Buffer.byteLength(file) > MAX_RESULT_BYTES) {
        throw new Error('Stored command result exceeds the supported size.');
      }
      return safeResultEnvelope(JSON.parse(file));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async putCommandResult(commandId, envelope) {
    normalizeCommandId(commandId);
    safeResultEnvelope(envelope);
    await this.ensureDirectories();

    const target = this.commandPath(commandId);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    const serialized = JSON.stringify(envelope);
    if (Buffer.byteLength(serialized) > MAX_RESULT_BYTES) {
      throw new Error(`Command result exceeds ${MAX_RESULT_BYTES} bytes.`);
    }

    await writeFile(temporary, serialized, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });

    try {
      await link(temporary, target);
      return envelope;
    } catch (error) {
      if (error?.code === 'EEXIST') return this.getCommandResult(commandId);
      throw error;
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async readSession(sessionId, { limit = 100 } = {}) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    const normalizedLimit = Number(limit);
    if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 500) {
      throw new Error('Session event limit must be an integer between 1 and 500.');
    }

    const path = this.sessionPath(normalizedSessionId);
    try {
      await stat(path);
    } catch (error) {
      if (isNotFound(error)) {
        return { session_id: normalizedSessionId, events: [] };
      }
      throw error;
    }

    const events = [];
    const reader = createInterface({
      input: createReadStream(path, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of reader) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      events.push(event);
      if (events.length > normalizedLimit) events.shift();
    }

    return { session_id: normalizedSessionId, events };
  }

  async deleteSession(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    const snapshot = await this.readSession(normalizedSessionId, { limit: 500 });
    const commandIds = new Set(snapshot.events.map((event) => event.command_id).filter(Boolean));

    let sessionDeleted = false;
    try {
      await unlink(this.sessionPath(normalizedSessionId));
      sessionDeleted = true;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }

    let commandResultsDeleted = 0;
    for (const commandId of commandIds) {
      try {
        await unlink(this.commandPath(commandId));
        commandResultsDeleted += 1;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }

    return {
      session_id: normalizedSessionId,
      deleted: sessionDeleted,
      command_results_deleted: commandResultsDeleted,
    };
  }
}

export function createMemorySessionStore() {
  const sessions = new Map();
  const commands = new Map();

  return {
    async appendEvent(event) {
      const sessionId = normalizeSessionId(event?.session_id);
      const events = sessions.get(sessionId) ?? [];
      events.push(structuredClone(event));
      sessions.set(sessionId, events);
    },
    async getCommandResult(commandId) {
      const value = commands.get(normalizeCommandId(commandId));
      return value ? structuredClone(value) : null;
    },
    async putCommandResult(commandId, envelope) {
      const id = normalizeCommandId(commandId);
      if (!commands.has(id)) commands.set(id, structuredClone(envelope));
      return structuredClone(commands.get(id));
    },
    async readSession(sessionId, { limit = 100 } = {}) {
      const id = normalizeSessionId(sessionId);
      const events = sessions.get(id) ?? [];
      return { session_id: id, events: structuredClone(events.slice(-limit)) };
    },
    async deleteSession(sessionId) {
      const id = normalizeSessionId(sessionId);
      const events = sessions.get(id) ?? [];
      const commandIds = new Set(events.map((event) => event.command_id));
      const deleted = sessions.delete(id);
      let commandResultsDeleted = 0;
      for (const commandId of commandIds) {
        if (commands.delete(commandId)) commandResultsDeleted += 1;
      }
      return {
        session_id: id,
        deleted,
        command_results_deleted: commandResultsDeleted,
      };
    },
  };
}
