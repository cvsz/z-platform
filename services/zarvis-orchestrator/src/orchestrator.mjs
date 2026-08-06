import { randomUUID } from 'node:crypto';
import {
  COMMAND_COMPLETED_SCHEMA,
  createToolAuditEvent,
  normalizeActorContext,
  normalizeCommandRequest,
  resolveCommandIntent,
} from './contracts.mjs';
import {
  executeGitHubRepositoryStatus,
  GITHUB_REPOSITORY_STATUS_TOOL,
} from './github-status-tool.mjs';

export const AVAILABLE_TOOLS = Object.freeze([GITHUB_REPOSITORY_STATUS_TOOL]);

function formatDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function createRepositoryStatusSpeech(repository, locale = 'th-TH') {
  const isThai = locale.toLowerCase().startsWith('th');
  const lastPush = formatDate(repository.pushed_at, locale);

  if (isThai) {
    const visibility = repository.private ? 'ส่วนตัว' : 'สาธารณะ';
    const lifecycle = repository.archived ? 'และถูกเก็บถาวรแล้ว' : 'และยังเปิดใช้งานอยู่';
    return `คลัง ${repository.full_name} เป็นคลัง${visibility} ${lifecycle} ใช้สาขาหลัก ${repository.default_branch} มี issues และ pull requests ที่เปิดรวม ${repository.open_issues_count} รายการ และมีการ push ล่าสุดเมื่อ ${lastPush} ตามเวลา UTC`;
  }

  const visibility = repository.private ? 'private' : 'public';
  const lifecycle = repository.archived ? 'archived' : 'active';
  return `${repository.full_name} is a ${visibility}, ${lifecycle} repository. Its default branch is ${repository.default_branch}. It has ${repository.open_issues_count} open issues and pull requests, and the latest push was ${lastPush} UTC.`;
}

export class ZarvisOrchestrator {
  constructor({
    githubStatusExecutor = executeGitHubRepositoryStatus,
    auditSink = async () => {},
    now = () => new Date(),
    idFactory = randomUUID,
  } = {}) {
    this.githubStatusExecutor = githubStatusExecutor;
    this.auditSink = auditSink;
    this.now = now;
    this.idFactory = idFactory;
  }

  async execute(rawCommand, rawContext = {}) {
    const command = normalizeCommandRequest(rawCommand);
    const actor = normalizeActorContext(rawContext);
    const intent = resolveCommandIntent(command);
    const startedAt = performance.now();

    try {
      let result;
      if (intent.name === 'github.repository.status') {
        result = await this.githubStatusExecutor(intent.arguments);
      } else {
        throw new Error(`Unregistered tool: ${intent.name}`);
      }

      const durationMs = performance.now() - startedAt;
      const audit = createToolAuditEvent({
        command,
        actor,
        intent,
        outcome: 'succeeded',
        durationMs,
        resultSummary: {
          repository: result.full_name,
          visibility: result.visibility,
          default_branch: result.default_branch,
          open_issues_count: result.open_issues_count,
        },
        now: this.now,
        eventId: this.idFactory(),
      });
      await this.auditSink(audit);

      return {
        schema_version: COMMAND_COMPLETED_SCHEMA,
        command_id: command.command_id,
        session_id: command.session_id,
        completed_at: this.now().toISOString(),
        status: 'completed',
        intent: {
          name: intent.name,
          source: intent.source,
        },
        result,
        speech: {
          locale: command.input.locale,
          text: createRepositoryStatusSpeech(result, command.input.locale),
        },
        audit: {
          event_id: audit.event_id,
          schema_version: audit.schema_version,
        },
      };
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      const audit = createToolAuditEvent({
        command,
        actor,
        intent,
        outcome: 'failed',
        durationMs,
        errorCode: error?.code ?? 'tool_execution_failed',
        now: this.now,
        eventId: this.idFactory(),
      });

      try {
        await this.auditSink(audit);
      } catch {
        // Preserve the original tool failure. Audit sink failures are reported by the sink itself.
      }
      throw error;
    }
  }
}
