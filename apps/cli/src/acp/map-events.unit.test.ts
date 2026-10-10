import { describe, expect, it } from 'vitest';
import {
  autoAllowPermissionResponse,
  isToolPermissionRequest,
  mapSessionUpdate,
} from './map-events.js';

describe('map-events', () => {
  it('maps agent_message_chunk to thought', () => {
    const events = mapSessionUpdate({
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'hello' },
      },
    });
    expect(events).toEqual([{ type: 'thought', content: 'hello' }]);
  });

  it('detects tool permission requests', () => {
    expect(
      isToolPermissionRequest({
        options: [{ optionId: 'allow-once' }, { optionId: 'reject-once' }],
      }),
    ).toBe(true);
    expect(
      isToolPermissionRequest({
        options: [{ id: 'a' }, { id: 'b' }],
      }),
    ).toBe(false);
  });

  it('auto-allows with allow-once', () => {
    expect(autoAllowPermissionResponse()).toEqual({
      outcome: { outcome: 'selected', optionId: 'allow-once' },
    });
  });
});
