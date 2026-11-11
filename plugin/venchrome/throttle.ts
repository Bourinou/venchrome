// Leading + trailing throttle (D-011): first change goes out now, later ones wait for the
// window to end and only the latest is sent. Identical states are never re-sent.

export interface Throttle<T> {
    push(value: T): void;
    /** Drops any pending value and forgets the last sent one. */
    cancel(): void;
}

export function createThrottle<T>(
    send: (value: T) => void,
    intervalMs: number,
    equals: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b)
): Throttle<T> {
    let last: { value: T } | undefined;
    let pending: { value: T } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const emit = (value: T) => {
        last = { value };
        send(value);
        timer = setTimeout(flush, intervalMs);
    };

    function flush() {
        timer = undefined;
        if (!pending) return;
        const { value } = pending;
        pending = undefined;
        if (last && equals(last.value, value)) return;
        emit(value);
    }

    return {
        push(value) {
            if (timer) {
                pending = { value };
                return;
            }
            if (last && equals(last.value, value)) return;
            emit(value);
        },
        cancel() {
            if (timer) clearTimeout(timer);
            timer = undefined;
            pending = undefined;
            last = undefined;
        }
    };
}
