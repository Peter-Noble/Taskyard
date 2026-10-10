import type { ThreadEvent } from '@taskyard/protocol';

/** Client-side shapes for ask/plan UI until protocol types are finalized. */

export type PendingQuestionOption = {
  id?: string;
  label: string;
  description?: string;
};

export type PendingQuestion = {
  id?: string;
  prompt: string;
  options?: PendingQuestionOption[];
  allow_free_text?: boolean;
};

export type PendingQuestionRequest = {
  kind: 'question';
  request_id: string;
  questions: PendingQuestion[];
};

export type PendingPlanRequest = {
  kind: 'plan';
  request_id: string;
  plan: string;
  name?: string;
};

export type PendingInteraction = PendingQuestionRequest | PendingPlanRequest;

export type ResolveQuestionBody = {
  request_id: string;
  kind: 'question';
  answers: Array<{ question_id?: string; answer: string | string[] }>;
};

export type ResolvePlanBody = {
  request_id: string;
  kind: 'plan';
  approved: boolean;
  feedback?: string;
};

export type ResolveInteractionBody = ResolveQuestionBody | ResolvePlanBody;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

function parseQuestions(raw: unknown): PendingQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingQuestion[] = [];
  for (const item of raw) {
    const obj = asRecord(item);
    if (!obj) continue;
    const prompt = readString(obj, 'prompt') ?? readString(obj, 'question') ?? readString(obj, 'text');
    if (!prompt) continue;

    const optionsRaw = obj.options ?? obj.choices;
    let options: PendingQuestionOption[] | undefined;
    if (Array.isArray(optionsRaw)) {
      const parsed: PendingQuestionOption[] = [];
      for (const opt of optionsRaw) {
        const o = asRecord(opt);
        if (!o) continue;
        const label = readString(o, 'label') ?? readString(o, 'text') ?? readString(o, 'title');
        if (!label) continue;
        parsed.push({
          id: readString(o, 'id'),
          label,
          description: readString(o, 'description'),
        });
      }
      if (parsed.length) options = parsed;
    }

    out.push({
      id: readString(obj, 'id'),
      prompt,
      options,
      allow_free_text: obj.allow_free_text === true || obj.allowFreeText === true,
    });
  }
  return out;
}

function parseAcpPending(payload: Record<string, unknown>, requestId: string): PendingInteraction | null {
  const method = readString(payload, 'method') ?? '';
  const inner = asRecord(payload.payload) ?? payload;

  if (method === 'cursor/create_plan' || method.endsWith('create_plan')) {
    const plan =
      readString(inner, 'plan') ??
      readString(inner, 'content') ??
      readString(inner, 'text') ??
      (typeof inner.plan === 'string' ? inner.plan : null);
    if (!plan) return null;
    return {
      kind: 'plan',
      request_id: requestId,
      plan,
      name: readString(inner, 'name') ?? readString(inner, 'title'),
    };
  }

  if (
    method === 'cursor/ask_question' ||
    method.endsWith('ask_question') ||
    method === 'session/request_permission'
  ) {
    const questions = parseQuestions(
      inner.questions ?? inner.items ?? inner.ask ?? payload.questions,
    );
    if (questions.length) {
      return { kind: 'question', request_id: requestId, questions };
    }
    // Permission-shaped question: options at top level with option labels as choices.
    const options = inner.options;
    if (Array.isArray(options) && options.length) {
      const prompt =
        readString(inner, 'toolCall') ??
        readString(asRecord(inner.toolCall) ?? {}, 'title') ??
        'Agent needs a decision';
      const parsedOpts: PendingQuestionOption[] = [];
      for (const opt of options) {
        const o = asRecord(opt);
        if (!o) continue;
        const label =
          readString(o, 'label') ??
          readString(o, 'name') ??
          readString(o, 'optionId') ??
          readString(o, 'id');
        if (!label) continue;
        parsedOpts.push({
          id: readString(o, 'optionId') ?? readString(o, 'id'),
          label,
        });
      }
      if (parsedOpts.length) {
        return {
          kind: 'question',
          request_id: requestId,
          questions: [{ prompt: String(prompt), options: parsedOpts }],
        };
      }
    }
  }

  return null;
}

function parseFromPayload(payload: Record<string, unknown>): PendingInteraction | null {
  const requestId =
    readString(payload, 'request_id') ??
    readString(payload, 'requestId') ??
    readString(payload, 'id');
  if (!requestId) return null;

  const eventName = readString(payload, 'event');
  const typeName = readString(payload, 'type');

  if (eventName === 'acp_pending' || typeName === 'acp_pending') {
    return parseAcpPending(payload, requestId);
  }

  const isQuestion =
    eventName === 'pending_question' ||
    typeName === 'ask_question' ||
    typeName === 'pending_question' ||
    payload.kind === 'question';

  if (isQuestion) {
    const questions = parseQuestions(payload.questions ?? payload.items ?? payload.ask);
    if (!questions.length) return null;
    return { kind: 'question', request_id: requestId, questions };
  }

  const isPlan =
    eventName === 'pending_plan' ||
    typeName === 'create_plan' ||
    typeName === 'pending_plan' ||
    payload.kind === 'plan';

  if (isPlan) {
    const plan =
      readString(payload, 'plan') ??
      readString(payload, 'content') ??
      readString(payload, 'text');
    if (!plan) return null;
    return {
      kind: 'plan',
      request_id: requestId,
      plan,
      name: readString(payload, 'name') ?? readString(payload, 'title'),
    };
  }

  return null;
}

const RESOLVED_EVENTS = new Set([
  'question_resolved',
  'plan_resolved',
  'pending_resolved',
  'permission_resolved',
]);

/** Latest unresolved pending ask/plan from the event stream (last wins). */
export function extractPendingInteraction(events: ThreadEvent[]): PendingInteraction | null {
  let pending: PendingInteraction | null = null;
  const resolvedIds = new Set<string>();

  for (const ev of events) {
    const p = ev.payload;
    const rec = asRecord(p);
    if (!rec) continue;

    const eventName = readString(rec, 'event');
    if (eventName && RESOLVED_EVENTS.has(eventName)) {
      const rid = readString(rec, 'request_id') ?? readString(rec, 'requestId');
      if (rid) resolvedIds.add(rid);
      continue;
    }

    const parsed = parseFromPayload(rec);
    if (parsed) {
      pending = parsed;
    }
  }

  if (!pending || resolvedIds.has(pending.request_id)) return null;
  return pending;
}
