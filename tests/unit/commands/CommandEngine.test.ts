import { CommandEngine } from '../../../src/engines/CommandEngine';
import { EventBus } from '../../../src/events/EventBus';
import { CacheManager } from '../../../src/cache/CacheManager';
import { PermissionManager } from '../../../src/permissions/PermissionManager';
import type { CommandHandler, CommandContext } from '../../../src/types/Command';
import type { SessionRuntime } from '../../../src/types/Session';
import type { NormalizedMessage } from '../../../src/types/Message';

function makeEngine() {
  const bus = new EventBus();
  const cache = new CacheManager();
  const perms = new PermissionManager(cache);
  return new CommandEngine(bus, cache, perms, '!');
}

const mockSession: SessionRuntime = {
  config: { id: 'sess1', owner: '1234@s.whatsapp.net', settings: {} },
  state: { id: 'sess1', status: 'connected', reconnectAttempts: 0 },
  dbNamespace: 'session_sess1',
  cacheNamespace: 'session:sess1',
};

function makeMessage(text: string): NormalizedMessage {
  return {
    id: 'msg1',
    sessionId: 'sess1',
    chatJid: '111@s.whatsapp.net',
    chatType: 'private',
    sender: { jid: '999@s.whatsapp.net', phone: '999', isBot: false },
    type: 'text',
    text,
    mentions: [],
    timestamp: Date.now(),
    isOwner: false,
    isCommand: text.startsWith('!'),
    raw: {},
  };
}

describe('CommandEngine', () => {
  it('registers and resolves a command', () => {
    const engine = makeEngine();
    const handler: CommandHandler = {
      meta: { name: 'ping', description: 'test', category: 'utility' },
      execute: jest.fn(),
    };
    engine.register(handler);
    expect(engine.has('ping')).toBe(true);
  });

  it('resolves a command via alias', () => {
    const engine = makeEngine();
    engine.register({
      meta: { name: 'ping', description: '', category: 'utility', aliases: ['p'] },
      execute: jest.fn(),
    });
    expect(engine.resolve('p')).toBeDefined();
  });

  it('executes a command when message matches', async () => {
    const engine = makeEngine();
    const executeFn = jest.fn();
    engine.register({
      meta: { name: 'ping', description: '', category: 'utility', cooldown: 0 },
      execute: executeFn,
    });
    await engine.handle(makeMessage('!ping'), mockSession);
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('does not execute if message has no prefix', async () => {
    const engine = makeEngine();
    const fn = jest.fn();
    engine.register({ meta: { name: 'ping', description: '', category: 'utility' }, execute: fn });
    await engine.handle(makeMessage('ping'), mockSession);
    expect(fn).not.toHaveBeenCalled();
  });

  it('parseArgs correctly splits tokens and flags', () => {
    const engine = makeEngine();
    const args = engine.parseArgs('hello "world foo" --verbose --name=pappy');
    expect(args.tokens).toContain('hello');
    expect(args.tokens).toContain('world foo');
    expect(args.flags['verbose']).toBe(true);
    expect(args.flags['name']).toBe('pappy');
  });
});
