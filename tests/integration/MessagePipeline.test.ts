import { MessagePipeline } from '../../src/engines/MessagePipeline';
import { CommandEngine } from '../../src/engines/CommandEngine';
import { MiddlewareEngine } from '../../src/middlewares/MiddlewareEngine';
import { EventBus } from '../../src/events/EventBus';
import { CacheManager } from '../../src/cache/CacheManager';
import { PermissionManager } from '../../src/permissions/PermissionManager';
import type { NormalizedMessage } from '../../src/types/Message';
import type { SessionRuntime } from '../../src/types/Session';
import type { CommandHandler } from '../../src/types/Command';

const session: SessionRuntime = {
  config: { id: 'sess1', owner: 'owner@s.whatsapp.net', settings: {} },
  state: { id: 'sess1', status: 'connected', reconnectAttempts: 0 },
  dbNamespace: 'session_sess1',
  cacheNamespace: 'session:sess1',
};

function makeMsg(text: string, isBot = false): NormalizedMessage {
  return {
    id: 'msg1', sessionId: 'sess1', chatJid: 'chat@s.whatsapp.net',
    chatType: 'private',
    sender: { jid: 'user@s.whatsapp.net', phone: '123', isBot },
    type: 'text', text, mentions: [],
    timestamp: Date.now(), isOwner: false,
    isCommand: text.startsWith('!'), raw: {},
  };
}

describe('MessagePipeline integration', () => {
  let bus: EventBus;
  let cache: CacheManager;
  let perms: PermissionManager;
  let commandEngine: CommandEngine;
  let pipeline: MessagePipeline;

  beforeEach(() => {
    bus = new EventBus();
    cache = new CacheManager(undefined, 300, 9999);
    perms = new PermissionManager(cache);
    commandEngine = new CommandEngine(bus, cache, perms, '!');
    pipeline = new MessagePipeline(bus, new MiddlewareEngine(), commandEngine);
  });

  afterEach(() => { cache.shutdown(); });

  it('emits message:received for valid messages', async () => {
    const handler = jest.fn();
    bus.on('message:received', handler);
    await pipeline.process(makeMsg('hello'), session);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('discards messages from bots', async () => {
    const handler = jest.fn();
    bus.on('message:received', handler);
    await pipeline.process(makeMsg('hello', true), session);
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatches command to registered handler', async () => {
    const execute = jest.fn();
    const cmd: CommandHandler = {
      meta: { name: 'ping', description: '', category: 'utility', cooldown: 0 },
      execute,
    };
    commandEngine.register(cmd);
    await pipeline.process(makeMsg('!ping'), session);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch unknown commands', async () => {
    const execute = jest.fn();
    commandEngine.register({ meta: { name: 'ping', description: '', category: 'utility' }, execute });
    await pipeline.process(makeMsg('!unknown'), session);
    expect(execute).not.toHaveBeenCalled();
  });

  it('discards messages with missing sender', async () => {
    const handler = jest.fn();
    bus.on('message:received', handler);
    const msg = makeMsg('hello');
    (msg.sender as unknown as Record<string, unknown>)['jid'] = '';
    await pipeline.process(msg, session);
    expect(handler).not.toHaveBeenCalled();
  });
});
