import { GridEventBus } from './events';

describe('GridEventBus', () => {
  describe('on', () => {
    it('returns an unsubscribe function that stops further delivery', () => {
      const bus = new GridEventBus();
      const handler = vi.fn();
      const unsubscribe = bus.on('sortChanged', handler);
      bus.emit('sortChanged', { sort: [] });
      expect(handler).toHaveBeenCalledTimes(1);
      unsubscribe();
      bus.emit('sortChanged', { sort: [] });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('emit', () => {
    it('calls every handler in subscription order', () => {
      const bus = new GridEventBus();
      const order: string[] = [];
      bus.on('sortChanged', () => order.push('first'));
      bus.on('sortChanged', () => order.push('second'));
      bus.emit('sortChanged', { sort: [] });
      expect(order).toEqual(['first', 'second']);
    });

    it('returns the same payload reference, so a handler mutation is visible to the emitter', () => {
      const bus = new GridEventBus();
      bus.on('rowExpanding', (payload) => {
        payload.canceled = true;
      });
      const result = bus.emit('rowExpanding', { key: 1, canceled: false });
      expect(result.canceled).toBe(true);
    });
  });

  describe('emitDistinct', () => {
    it('emits the first time and returns true', () => {
      const bus = new GridEventBus();
      const handler = vi.fn();
      bus.on('sortChanged', handler);
      const emitted = bus.emitDistinct('sortChanged', { sort: [{ field: 'a' }] });
      expect(emitted).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not emit, and returns false, for a structurally identical payload with a different identity', () => {
      const bus = new GridEventBus();
      const handler = vi.fn();
      bus.on('sortChanged', handler);
      bus.emitDistinct('sortChanged', { sort: [{ field: 'a' }] });
      const emitted = bus.emitDistinct('sortChanged', { sort: [{ field: 'a' }] });
      expect(emitted).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits again once the content changes', () => {
      const bus = new GridEventBus();
      const handler = vi.fn();
      bus.on('sortChanged', handler);
      bus.emitDistinct('sortChanged', { sort: [{ field: 'a' }] });
      const emitted = bus.emitDistinct('sortChanged', { sort: [{ field: 'b' }] });
      expect(emitted).toBe(true);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('treats key order as irrelevant to the dedup comparison', () => {
      const bus = new GridEventBus();
      const handler = vi.fn();
      bus.on('rowExpanding', handler);
      bus.emitDistinct('rowExpanding', { key: 1, canceled: false });
      const emitted = bus.emitDistinct('rowExpanding', { canceled: false, key: 1 });
      expect(emitted).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('drops every subscription', () => {
      const bus = new GridEventBus();
      const handler = vi.fn();
      bus.on('sortChanged', handler);
      bus.clear();
      bus.emit('sortChanged', { sort: [] });
      expect(handler).not.toHaveBeenCalled();
    });

    it('drops the dedup baseline, so an identical payload emits again after clear', () => {
      const bus = new GridEventBus();
      bus.emitDistinct('sortChanged', { sort: [{ field: 'a' }] });
      bus.clear();
      const handler = vi.fn();
      bus.on('sortChanged', handler);
      const emitted = bus.emitDistinct('sortChanged', { sort: [{ field: 'a' }] });
      expect(emitted).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
