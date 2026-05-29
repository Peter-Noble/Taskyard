'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTestData } from '@/lib/hooks/use-test-data';
import { TEST_AUTO_RULES, type TestAutoRule } from '@/lib/test-data/fixtures';

type TriggerType = 'event' | 'schedule' | 'combined';
type Rule = TestAutoRule;

function triggerLabel(rule: Rule): string {
  if (rule.trigger === 'event') {
    const ev = rule.eventType === 'pr.opened' ? 'PR opened' : rule.eventType ?? 'event';
    return `GitHub · ${ev}`;
  }
  if (rule.trigger === 'schedule') {
    const dayMap: Record<string, string> = {
      fri: 'Fri',
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      sat: 'Sat',
      sun: 'Sun',
    };
    const day = dayMap[rule.schedDay ?? 'fri'] ?? rule.schedDay;
    return `Schedule · ${day} ${rule.schedTime ?? '18:00'}`;
  }
  return 'Schedule + commits';
}

function schedulePreview(day: string, time: string, tz: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  const tzShort = tz.split('/').pop()?.replace('_', ' ') ?? tz;
  return `Every ${day} at ${h12}:${m} ${ampm} (${tzShort})`;
}

export function AutoClient() {
  const { useTestData: testDataOn } = useTestData();
  const [rules, setRules] = useState<Rule[]>(() => structuredClone(TEST_AUTO_RULES));
  const [selectedId, setSelectedId] = useState(TEST_AUTO_RULES[0].id);
  const [tags, setTags] = useState<string[]>([]);
  const [form, setForm] = useState<Rule>(() => structuredClone(TEST_AUTO_RULES[0]));
  const [schedulePreviewText, setSchedulePreviewText] = useState('');

  useEffect(() => {
    if (testDataOn) {
      setRules(structuredClone(TEST_AUTO_RULES));
      setSelectedId(TEST_AUTO_RULES[0].id);
      setForm(structuredClone(TEST_AUTO_RULES[0]));
      setTags([...(TEST_AUTO_RULES[0].tags ?? [])]);
    } else {
      setRules([]);
      setSelectedId('');
      setTags([]);
    }
  }, [testDataOn]);

  const selected = rules.find((r) => r.id === selectedId) ?? rules[0];

  const loadForm = useCallback((rule: Rule) => {
    setForm(structuredClone(rule));
    setTags([...(rule.tags ?? [])]);
  }, []);

  useEffect(() => {
    const dayLabels: Record<string, string> = {
      mon: 'Monday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      thu: 'Thursday',
      fri: 'Friday',
      sat: 'Saturday',
      sun: 'Sunday',
    };
    const day = dayLabels[form.schedDay ?? 'fri'] ?? 'Friday';
    setSchedulePreviewText(
      schedulePreview(day, form.schedTime ?? '18:00', form.schedTz ?? 'America/Los_Angeles'),
    );
  }, [form.schedDay, form.schedTime, form.schedTz]);

  function selectRule(id: string) {
    setSelectedId(id);
    const rule = rules.find((r) => r.id === id);
    if (rule) loadForm(rule);
  }

  function persistForm(nextForm: Rule, nextTags: string[]) {
    setRules((prev) =>
      prev.map((r) => (r.id === selectedId ? { ...nextForm, tags: nextTags } : r)),
    );
  }

  function updateForm(patch: Partial<Rule>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      persistForm(next, tags);
      return next;
    });
  }

  function setTriggerType(type: TriggerType) {
    updateForm({ trigger: type });
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || tags.includes(t)) return;
    const nextTags = [...tags, t];
    setTags(nextTags);
    persistForm(form, nextTags);
  }

  function removeTag(tag: string) {
    const nextTags = tags.filter((x) => x !== tag);
    setTags(nextTags);
    persistForm(form, nextTags);
  }

  function newRule() {
    const id = `rule-${Date.now()}`;
    const rule: Rule = {
      id,
      name: 'New automation rule',
      enabled: true,
      trigger: 'event',
      lastRun: 'Never run',
      taskTitle: '',
      taskDesc: '',
      project: 'taskyard-ui',
      tags: [],
      eventSource: 'github',
      eventType: 'pr.opened',
      eventRepo: '',
    };
    setRules((prev) => [...prev, rule]);
    setSelectedId(id);
    loadForm(rule);
  }

  function deleteRule() {
    if (rules.length <= 1) return;
    const next = rules.filter((r) => r.id !== selectedId);
    setRules(next);
    setSelectedId(next[0].id);
    loadForm(next[0]);
  }

  function duplicateRule() {
    const copy = structuredClone(form);
    copy.id = `rule-${Date.now()}`;
    copy.name = `${form.name} (copy)`;
    copy.lastRun = 'Never run';
    setRules((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    loadForm(copy);
  }

  return (
    <AppShell>
      <div className="auto-layout">
        {!testDataOn ? (
          <section className="auto-editor" aria-label="Rule editor" style={{ gridColumn: '1 / -1' }}>
            <p className="empty-state">
              No automation rules yet. Turn on <strong>Test data</strong> in the header to preview the Auto
              wireframe, or connect rules from the API when available.
            </p>
          </section>
        ) : (
          <>
        <aside className="auto-rules-rail" aria-label="Automation rules">
          <header className="auto-rail-head">
            <span className="auto-rail-label">Rules</span>
            <button type="button" className="btn btn-primary btn-rail-new" onClick={newRule}>
              New rule
            </button>
          </header>
          <ul className="auto-rule-list" role="listbox" aria-label="Select a rule">
            {rules.map((rule, idx) => (
              <li key={rule.id}>
                <button
                  type="button"
                  className="auto-rule-item"
                  role="option"
                  aria-selected={rule.id === selectedId}
                  onClick={() => selectRule(rule.id)}
                >
                  <div className="auto-rule-item-row">
                    <span className="entity-num" aria-hidden="true">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="auto-rule-item-main">
                      <div className="auto-rule-item-title-row">
                        <h3>{rule.name}</h3>
                        <span className={`badge ${rule.enabled ? 'badge-completed' : 'badge-waiting'}`}>
                          <span className="badge-dot" />
                          {rule.enabled ? 'On' : 'Paused'}
                        </span>
                      </div>
                      <div className="auto-rule-item-meta spec-mono">{triggerLabel(rule)}</div>
                      {rule.tags.length ? (
                        <div className="auto-rule-tags">
                          {rule.tags.map((t) => (
                            <span key={t} className="tag-chip tag-chip-sm">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="auto-editor" aria-label="Rule editor">
          <form
            className="auto-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              persistForm(form, tags);
            }}
          >
            <header className="auto-form-head">
              <div className="auto-form-title-row">
                <input
                  type="text"
                  className="form-input form-input-title"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value.trim() || 'Untitled rule' })}
                  placeholder="Rule name"
                  aria-label="Rule name"
                  required
                />
                <label className="auto-toggle">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => updateForm({ enabled: e.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
              </div>
              <p className="auto-form-hint">Last run: {selected?.lastRun || '—'}</p>
            </header>

            <div className="auto-form-section">
              <h3 className="card-title">Task template</h3>
              <div className="form-grid">
                <label className="form-field form-field-full">
                  <span className="form-label">Title</span>
                  <input
                    type="text"
                    className="form-input"
                    value={form.taskTitle}
                    onChange={(e) => updateForm({ taskTitle: e.target.value })}
                    placeholder="e.g. Review PR — {{repo}}/{{number}}"
                  />
                </label>
                <label className="form-field form-field-full">
                  <span className="form-label">Description</span>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={form.taskDesc}
                    onChange={(e) => updateForm({ taskDesc: e.target.value })}
                    placeholder="Instructions for the agent when this rule fires…"
                  />
                </label>
                <label className="form-field form-field-full">
                  <span className="form-label">Project</span>
                  <select
                    className="form-select"
                    value={form.project}
                    onChange={(e) => updateForm({ project: e.target.value })}
                  >
                    <option value="taskyard-ui">taskyard-ui</option>
                    <option value="invoice-pdf-parser">invoice-pdf-parser</option>
                    <option value="homelab-infra">homelab-infra</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="auto-form-section">
              <h3 className="card-title">Default tags</h3>
              <p className="form-help">Applied to every task this rule creates. Leave empty for no tags.</p>
              <div className="tag-input-wrap">
                <div className="tag-chips" aria-live="polite">
                  {tags.map((t) => (
                    <span key={t} className="tag-chip">
                      {t}
                      <button
                        type="button"
                        className="tag-remove"
                        aria-label={`Remove ${t}`}
                        onClick={() => removeTag(t)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  className="form-input tag-text-input"
                  placeholder="Type a tag and press Enter"
                  aria-label="Add tag"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    const input = e.currentTarget;
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag(input.value);
                      input.value = '';
                    }
                    if (e.key === 'Backspace' && !input.value && tags.length) {
                      removeTag(tags[tags.length - 1]);
                    }
                  }}
                />
              </div>
            </div>

            <div className="auto-form-section">
              <h3 className="card-title">Trigger</h3>
              <div className="filter-tabs trigger-tabs" role="tablist" aria-label="Trigger type">
                {(['event', 'schedule', 'combined'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={form.trigger === t}
                    onClick={() => setTriggerType(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {form.trigger === 'event' ? (
                <div className="trigger-panel">
                  <div className="form-grid">
                    <label className="form-field">
                      <span className="form-label">Source</span>
                      <select
                        className="form-select"
                        value={form.eventSource ?? 'github'}
                        onChange={(e) => updateForm({ eventSource: e.target.value })}
                      >
                        <option value="github">GitHub</option>
                        <option value="gitlab">GitLab</option>
                        <option value="webhook">Custom webhook</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span className="form-label">Event</span>
                      <select
                        className="form-select"
                        value={form.eventType ?? 'pr.opened'}
                        onChange={(e) => updateForm({ eventType: e.target.value })}
                      >
                        <option value="pr.opened">Pull request opened</option>
                        <option value="pr.labeled">Pull request labeled</option>
                        <option value="push">Push to branch</option>
                        <option value="issue.opened">Issue opened</option>
                      </select>
                    </label>
                    <label className="form-field form-field-full">
                      <span className="form-label">Repository filter</span>
                      <input
                        type="text"
                        className="form-input spec-mono"
                        value={form.eventRepo ?? ''}
                        onChange={(e) => updateForm({ eventRepo: e.target.value })}
                        placeholder="org/repo or org/*"
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {form.trigger === 'schedule' ? (
                <div className="trigger-panel">
                  <div className="form-grid">
                    <label className="form-field">
                      <span className="form-label">Frequency</span>
                      <select
                        className="form-select"
                        value={form.schedFreq ?? 'weekly'}
                        onChange={(e) => updateForm({ schedFreq: e.target.value })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="weekdays">Weekdays only</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span className="form-label">Day</span>
                      <select
                        className="form-select"
                        value={form.schedDay ?? 'fri'}
                        onChange={(e) => updateForm({ schedDay: e.target.value })}
                      >
                        <option value="mon">Monday</option>
                        <option value="tue">Tuesday</option>
                        <option value="wed">Wednesday</option>
                        <option value="thu">Thursday</option>
                        <option value="fri">Friday</option>
                        <option value="sat">Saturday</option>
                        <option value="sun">Sunday</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span className="form-label">Time</span>
                      <input
                        type="time"
                        className="form-input"
                        value={form.schedTime ?? '18:00'}
                        onChange={(e) => updateForm({ schedTime: e.target.value })}
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-label">Timezone</span>
                      <select
                        className="form-select"
                        value={form.schedTz ?? 'America/Los_Angeles'}
                        onChange={(e) => updateForm({ schedTz: e.target.value })}
                      >
                        <option value="America/Los_Angeles">America/Los_Angeles</option>
                        <option value="America/New_York">America/New_York</option>
                        <option value="Europe/London">Europe/London</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </label>
                  </div>
                  <p className="schedule-preview spec-mono">{schedulePreviewText}</p>
                </div>
              ) : null}

              {form.trigger === 'combined' ? (
                <div className="trigger-panel">
                  <p className="form-help">Runs on a schedule, but only creates tasks when the condition is met.</p>
                  <fieldset className="auto-fieldset">
                    <legend className="form-label">Schedule (same as above)</legend>
                    <div className="form-grid">
                      <label className="form-field">
                        <span className="form-label">Frequency</span>
                        <select
                          className="form-select"
                          value={form.comboFreq ?? 'daily'}
                          onChange={(e) => updateForm({ comboFreq: e.target.value })}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="form-label">Time</span>
                        <input
                          type="time"
                          className="form-input"
                          value={form.comboTime ?? '18:00'}
                          onChange={(e) => updateForm({ comboTime: e.target.value })}
                        />
                      </label>
                    </div>
                  </fieldset>
                  <fieldset className="auto-fieldset">
                    <legend className="form-label">Condition</legend>
                    <label className="form-field form-field-full">
                      <span className="form-label">Only if</span>
                      <select
                        className="form-select"
                        value={form.comboCondition ?? 'commits'}
                        onChange={(e) => updateForm({ comboCondition: e.target.value })}
                      >
                        <option value="commits">New commits since last run (per project)</option>
                        <option value="open-prs">Open pull requests exist</option>
                        <option value="stale-threads">Stale threads older than 48h</option>
                      </select>
                    </label>
                    <label className="form-field form-field-full">
                      <span className="form-label">Scope</span>
                      <select
                        className="form-select"
                        value={form.comboScope ?? 'each-project'}
                        onChange={(e) => updateForm({ comboScope: e.target.value })}
                      >
                        <option value="each-project">Each linked project separately</option>
                        <option value="workspace">Once per workspace</option>
                      </select>
                    </label>
                  </fieldset>
                </div>
              ) : null}
            </div>

            <footer className="auto-form-actions">
              <button type="button" className="btn btn-danger" onClick={deleteRule}>
                Delete rule
              </button>
              <span className="auto-form-actions-spacer" />
              <button type="button" className="btn btn-ghost" onClick={duplicateRule}>
                Duplicate
              </button>
              <button type="submit" className="btn btn-primary">
                Save rule
              </button>
            </footer>
          </form>
        </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
