class EventQueue<T extends Record<string, any>> {
    private _events: T[] = [];

    push(event: T) {
        this._events.push(event);
    }

    next() {
        return this._events.shift() ?? null;
    }

    hasNext() {
        return this._events.length > 0;
    }
}

export { EventQueue };