'use client';

import { useState } from 'react';
import type {
  PendingInteraction,
  PendingQuestion,
  ResolveInteractionBody,
} from '@/lib/pending-interaction';

type PendingInteractionWidgetProps = {
  threadId: string;
  interaction: PendingInteraction;
  disabled?: boolean;
  onResolved?: () => void;
};

type QuestionAnswers = Record<string, string>;

function questionKey(q: PendingQuestion, index: number): string {
  return q.id ?? `q-${index}`;
}

export function PendingInteractionWidget({
  threadId,
  interaction,
  disabled = false,
  onResolved,
}: PendingInteractionWidgetProps) {
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  const [planApproved, setPlanApproved] = useState<boolean | null>(null);
  const [planFeedback, setPlanFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postResolve(body: ResolveInteractionBody) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Resolve failed');
      }
      onResolved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (interaction.kind === 'plan') {
    return (
      <section className="pending-widget pending-widget-plan" aria-label="Plan approval">
        <header className="pending-widget-head">
          <h3 className="pending-widget-title">{interaction.name ?? 'Agent plan'}</h3>
          <p className="pending-widget-hint">Review the plan and approve or request changes.</p>
        </header>
        <pre className="pending-widget-plan-body">{interaction.plan}</pre>
        <label className="form-field form-field-full">
          <span className="form-label">Feedback (optional)</span>
          <textarea
            className="form-textarea"
            rows={2}
            value={planFeedback}
            disabled={disabled || submitting}
            onChange={(e) => setPlanFeedback(e.target.value)}
            placeholder="Changes or notes for the agent…"
          />
        </label>
        <div className="pending-widget-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled || submitting}
            onClick={() => {
              setPlanApproved(true);
              void postResolve({
                request_id: interaction.request_id,
                kind: 'plan',
                approved: true,
                feedback: planFeedback.trim() || undefined,
              });
            }}
          >
            {submitting && planApproved === true ? 'Submitting…' : 'Approve plan'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={disabled || submitting}
            onClick={() => {
              setPlanApproved(false);
              void postResolve({
                request_id: interaction.request_id,
                kind: 'plan',
                approved: false,
                feedback: planFeedback.trim() || undefined,
              });
            }}
          >
            {submitting && planApproved === false ? 'Submitting…' : 'Request changes'}
          </button>
        </div>
        {error ? <p className="modal-error">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="pending-widget pending-widget-question" aria-label="Agent question">
      <header className="pending-widget-head">
        <h3 className="pending-widget-title">Agent needs your input</h3>
      </header>
      {interaction.questions.map((q, index) => {
        const key = questionKey(q, index);
        return (
          <fieldset key={key} className="pending-question">
            <legend className="pending-question-prompt">{q.prompt}</legend>
            {q.options?.length ? (
              <div className="pending-question-options">
                {q.options.map((opt) => {
                  const optKey = opt.id ?? opt.label;
                  const selected = answers[key] === opt.label;
                  return (
                    <label key={optKey} className="pending-option">
                      <input
                        type="radio"
                        name={key}
                        checked={selected}
                        disabled={disabled || submitting}
                        onChange={() => setAnswers((prev) => ({ ...prev, [key]: opt.label }))}
                      />
                      <span>
                        {opt.label}
                        {opt.description ? (
                          <span className="pending-option-desc"> — {opt.description}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
            {(q.allow_free_text !== false || !q.options?.length) && (
              <input
                type="text"
                className="form-input pending-question-text"
                placeholder="Your answer…"
                disabled={disabled || submitting}
                value={answers[key] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            )}
          </fieldset>
        );
      })}
      <div className="pending-widget-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || submitting}
          onClick={() => {
            const payload: ResolveInteractionBody = {
              request_id: interaction.request_id,
              kind: 'question',
              answers: interaction.questions.map((q, index) => ({
                question_id: q.id,
                answer: answers[questionKey(q, index)] ?? '',
              })),
            };
            void postResolve(payload);
          }}
        >
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
      {error ? <p className="modal-error">{error}</p> : null}
    </section>
  );
}
