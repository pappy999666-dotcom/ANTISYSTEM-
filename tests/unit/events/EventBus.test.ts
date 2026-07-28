import { EventBus } from '../../../src/events/EventBus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('calls registered listener on emit', async () => {
    const handler = jest.fn();
    bus.on('plugin:loaded', handler);
    await bus.emit('plugin:loaded', { pluginId: 'test' });
    expect(handler).toHaveBeenCalledWith({ pluginId: 'test' });
  });

  it('supports once — only fires once', async () => {
    const handler = jest.fn();
    bus.once('plugin:loaded', handler);
    await bus.emit('plugin:loaded', { pluginId: 'a' });
    await bus.emit('plugin:loaded', { pluginId: 'b' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls higher-priority listener first', async () => {
    const order: number[] = [];
    bus.on('plugin:loaded', () => { order.push(1); }, 5);
    bus.on('plugin:loaded', () => { order.push(2); }, 10);
    await bus.emit('plugin:loaded', { pluginId: 'x' });
    expect(order).toEqual([2, 1]);
  });

  it('off() removes a listener by ID', async () => {
    const handler = jest.fn();
    const id = bus.on('plugin:loaded', handler);
    bus.off(id);
    await bus.emit('plugin:loaded', { pluginId: 'y' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates errors in one listener from others', async () => {
    const good = jest.fn();
    bus.on('plugin:loaded', () => { throw new Error('bad listener'); }, 10);
    bus.on('plugin:loaded', good, 1);
    await bus.emit('plugin:loaded', { pluginId: 'z' });
    expect(good).toHaveBeenCalled();
  });
});
