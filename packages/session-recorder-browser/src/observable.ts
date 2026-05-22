export class Observable<N extends string> {
  protected _observers: Map<N, Set<Function>> = new Map()

  on(name: N, f: Function): void {
    let listeners = this._observers.get(name)
    if (!listeners) {
      listeners = new Set()
      this._observers.set(name, listeners)
    }
    listeners.add(f)
  }

  once(name: N, f: Function): void {
    const _f = (...args: any[]) => {
      this.off(name, _f)
      f(...args)
    }
    this.on(name, _f)
  }

  off(name: N, f: Function): void {
    const observers = this._observers.get(name)
    if (observers) {
      observers.delete(f)
      if (observers.size === 0) {
        this._observers.delete(name)
      }
    }
  }

  emit(name: N, args: any[]): void {
    const listeners = this._observers.get(name)
    if (listeners) {
      Array.from(listeners).forEach((f) => f(...args))
    }
  }

  destroy(): void {
    this._observers.clear()
  }
}
