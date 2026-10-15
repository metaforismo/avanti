export class CircuitBreaker {
  private states = new Map<string, { failures: number; until: number; probe: boolean }>();
  constructor(
    private threshold = 3,
    private cooldownMs = 30000,
  ) {}
  acquire(model: string, now: number) {
    const state = this.states.get(model);
    if (!state || state.failures < this.threshold) return true;
    if (now < state.until || state.probe) return false;
    state.probe = true;
    return true;
  }
  release(model: string) {
    const state = this.states.get(model);
    if (state) state.probe = false;
  }
  success(model: string) {
    this.states.delete(model);
  }
  failure(model: string, now: number) {
    const previous = this.states.get(model);
    const failures = (previous?.failures ?? 0) + 1;
    this.states.set(model, {
      failures,
      until: failures >= this.threshold ? now + this.cooldownMs : 0,
      probe: false,
    });
  }
  snapshot() {
    return [...this.states].map(([model, state]) => ({ model, ...state }));
  }
}
