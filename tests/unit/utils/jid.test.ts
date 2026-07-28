import {
  jidToPhone, phoneToJid, isGroupJid, isUserJid,
  normalizeJid, jidEquals,
} from '../../../src/utils/jid';

describe('jidToPhone', () => {
  it('extracts phone from user JID', () => expect(jidToPhone('628123@s.whatsapp.net')).toBe('628123'));
  it('strips device suffix', () => expect(jidToPhone('628123:5@s.whatsapp.net')).toBe('628123'));
});

describe('phoneToJid', () => {
  it('converts phone to JID', () => expect(phoneToJid('628123456789')).toBe('628123456789@s.whatsapp.net'));
  it('strips non-digits', () => expect(phoneToJid('+62 812-3456')).toBe('628123456@s.whatsapp.net'));
});

describe('isGroupJid', () => {
  it('returns true for group JID', () => expect(isGroupJid('123456789@g.us')).toBe(true));
  it('returns false for user JID', () => expect(isGroupJid('123@s.whatsapp.net')).toBe(false));
});

describe('isUserJid', () => {
  it('returns true for user JID', () => expect(isUserJid('123@s.whatsapp.net')).toBe(true));
  it('returns false for group JID', () => expect(isUserJid('123@g.us')).toBe(false));
});

describe('normalizeJid', () => {
  it('strips device suffix', () => expect(normalizeJid('628123:5@s.whatsapp.net')).toBe('628123@s.whatsapp.net'));
  it('leaves clean JID unchanged', () => expect(normalizeJid('628123@s.whatsapp.net')).toBe('628123@s.whatsapp.net'));
  it('handles empty string', () => expect(normalizeJid('')).toBe(''));
});

describe('jidEquals', () => {
  it('matches JIDs ignoring device suffix', () => {
    expect(jidEquals('628123:5@s.whatsapp.net', '628123@s.whatsapp.net')).toBe(true);
  });
  it('returns false for different numbers', () => {
    expect(jidEquals('628111@s.whatsapp.net', '628222@s.whatsapp.net')).toBe(false);
  });
});
