import { describe, it, expect } from 'vitest';
import {
  mapMessage,
  mapConversationRow,
  mapCall,
  mapContact,
  mapBackendSettings,
  DEFAULT_AI_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  DEFAULT_CALL_SETTINGS,
} from '../src/lib/mappers';
import type { BackendCall, BackendContact, BackendMessage, BackendConversation } from '../src/lib/api';

describe('mappers', () => {
  describe('mapMessage', () => {
    const base: BackendMessage = {
      id: 'm1',
      conversationId: 'c1',
      sender: 'user',
      content: 'hello',
      messageType: 'user',
      metadata: null,
      createdAt: '2026-09-19T10:00:00.000Z',
    };

    it('maps sender roles', () => {
      expect(mapMessage(base).role).toBe('user');
      expect(mapMessage({ ...base, sender: 'assistant' }).role).toBe('assistant');
      expect(mapMessage({ ...base, sender: 'agent' }).role).toBe('assistant');
      expect(mapMessage({ ...base, sender: 'system' }).role).toBe('system');
    });

    it('provides a timestamp', () => {
      expect(mapMessage(base).timestamp).toBeTruthy();
    });
  });

  describe('mapConversationRow', () => {
    const row: BackendConversation = {
      id: 'c1',
      title: 'Support chat',
      type: 'web',
      status: 'active',
      startedAt: '2026-09-19T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
      messageCount: 3,
      lastMessage: null,
      summary: null,
    };

    it('maps a conversation row', () => {
      const conv = mapConversationRow(row);
      expect(conv.id).toBe('c1');
      expect(conv.type).toBe('web');
      expect(conv.status).toBe('active');
      expect(conv.messageCount).toBe(3);
      expect(conv.dateLabel).toBe('Today');
      expect(conv.messages).toEqual([]);
    });

    it('maps archive/ended statuses', () => {
      expect(mapConversationRow({ ...row, status: 'archived' }).status).toBe('archived');
      expect(mapConversationRow({ ...row, status: 'completed' }).status).toBe('completed');
    });
  });

  describe('mapCall', () => {
    const base: BackendCall = {
      id: 'call1',
      user_id: 'u1',
      contact_id: null,
      conversation_id: null,
      contact_name: 'Ada Lovelace',
      phone_number: '+15551234567',
      direction: 'outbound',
      status: 'ai_active',
      ai_status: 'ai_handled',
      provider: 'twilio',
      provider_call_id: null,
      duration_seconds: 125,
      recording_url: null,
      created_at: '2026-09-19T10:00:00.000Z',
      updated_at: '2026-09-19T10:02:00.000Z',
      started_at: null,
      ended_at: null,
    };

    it('maps an active call', () => {
      const call = mapCall(base);
      expect(call.phoneNumber).toBe('+15551234567');
      expect(call.contactName).toBe('Ada Lovelace');
      expect(call.status).toBe('connected');
      expect(call.aiStatus).toBe('AI handled');
      expect(call.duration).toBe('02:05');
      expect(call.date).toBe('Today');
    });

    it('maps terminal call statuses', () => {
      expect(mapCall({ ...base, status: 'ended' }).status).toBe('completed');
      expect(mapCall({ ...base, status: 'failed' }).status).toBe('failed');
      expect(mapCall({ ...base, status: 'missed' }).status).toBe('missed');
      expect(mapCall({ ...base, status: 'human_active', ai_status: 'human_takeover' }).aiStatus).toBe('Human takeover');
    });

    it('falls back to phone number for unknown contact', () => {
      const call = mapCall({ ...base, contact_name: null });
      expect(call.contactName).toBe('+15551234567');
    });
  });

  describe('mapContact', () => {
    const c: BackendContact = {
      id: 'cnt1',
      name: 'Grace Hopper',
      phone: '+19995550111',
      email: null,
      company: 'Naval',
      notes: null,
      lastCall: null,
      callCount: 2,
    };

    it('maps a contact with safe fallbacks', () => {
      expect(mapContact(c)).toEqual({ id: 'cnt1', name: 'Grace Hopper', phone: '+19995550111', email: '', company: 'Naval', notes: '', lastCall: '', callCount: 2 });
    });
  });

  describe('mapBackendSettings', () => {
    it('merges remote settings over defaults', () => {
      const mapped = mapBackendSettings({
        ai: { model: 'llama3.2:3b', temperature: 0.3, maxTokens: 100, systemPrompt: 'Be brief.', historyLimit: 10 },
        voice: { whisperModel: 'small', whisperLanguage: 'English', ttsEngine: 'piper', ttsVoice: 'amy', speakingSpeed: 1.1, silenceThresholdMs: 700, autoDetectVad: false, autoWake: false, cameraEnabled: true, faceAnalysisEnabled: true },
        call: { autoAnswer: false, aiGreeting: 'Hi', maxCallDurationMinutes: 5, enableRecording: false, enableHumanTakeover: false, bargeInEnabled: false },
      });
      expect(mapped.ai.model).toBe('llama3.2:3b');
      expect(mapped.ai.temperature).toBe(0.3);
      expect(mapped.voice.silenceThresholdMs).toBe(700);
      expect(mapped.voice.cameraEnabled).toBe(true);
      expect(mapped.call.maxCallDurationMinutes).toBe(5);
    });

    it('uses defaults for missing sections', () => {
      const mapped = mapBackendSettings({ ai: DEFAULT_AI_SETTINGS, voice: DEFAULT_VOICE_SETTINGS, call: DEFAULT_CALL_SETTINGS });
      expect(mapped.ai.historyLimit).toBe(20);
      expect(mapped.voice.autoDetectVad).toBe(true);
      expect(mapped.call.bargeInEnabled).toBe(true);
    });
  });
});