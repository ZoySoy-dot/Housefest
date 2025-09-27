"use server";

import { retain } from "./arrays";

class Completer<T> {
    readonly promise: Promise<T>;
    readonly resolve: (value: T | PromiseLike<T>) => void;
    readonly reject: (reason?: any) => void;

    constructor() {
        let promise_resolve: (value: T | PromiseLike<T>) => void;
        let promise_reject: (reason?: any) => void;

        this.promise = new Promise((resolve, reject) => {
            promise_resolve = resolve;
            promise_reject = reject;
        });

        /* 
        SAFETY:
        The callback passed to [Promise]'s constructor is called immediately and synchronously so
        [promise_resolve] and [promise_reject] should have valid values by now.

        https://stackoverflow.com/questions/42118900/when-is-the-body-of-a-promise-constructor-callback-executed
        */
        this.resolve = promise_resolve!;
        this.reject = promise_reject!;
    }

    static completed<T>(value: T) {
        const completer = new Completer<T>();

        completer.resolve(value);

        return completer;
    }
}

type Result<T, E> = {
    ok: T
} | {
    error: E
};

type ChannelError = "stopped_receiving";

type Channel<T> = {
    sender: (message: T) => Result<undefined, ChannelError>,
    receiver: () => Promise<Result<T, ChannelError>>,
    is_receiving: () => boolean,
    stop_receiving: () => void,
};

function channel<T>(): Channel<T> {
    let stopped_receiving = false;

    const messages: T[] = [];
    const message_waiters: Completer<Result<T, ChannelError>>[] = [];

    return {
        sender: (message: T) => {
            if (stopped_receiving) {
                return { error: "stopped_receiving" };
            }

            const waiter = message_waiters.shift();

            if (waiter !== undefined) {
                waiter.resolve({ ok: message });
                return { ok: undefined };
            }

            messages.push(
                message
            );

            return { ok: undefined };
        },
        receiver: async () => {
            if (stopped_receiving) {
                return { error: "stopped_receiving" };
            }

            const message = messages.shift();

            if (message !== undefined) {
                return { ok: message };
            }

            const waiter = new Completer<Result<T, ChannelError>>();

            message_waiters.push(waiter);

            return await waiter.promise;
        },
        is_receiving: () => !stopped_receiving,
        stop_receiving: () => {
            stopped_receiving = true;

            for (const waiter of message_waiters) {
                waiter.resolve({
                    error: "stopped_receiving"
                });
            }
        }
    };
}

class Observable<T> {
    readonly observers: ((updated: T) => Result<undefined, ChannelError>)[];

    constructor(
        private value: T
    ) {
        this.observers = [];
    }

    observer_count() {
        return this.observers.length;
    }

    get() {
        return this.value;
    }

    selecting_subscribe<U>(selector: (updated: T) => U): AsyncIterable<Result<U, ChannelError>> {
        const { sender, receiver, is_receiving } = channel<U>();

        const notify = (updated: T) => {
            return sender(selector(updated));
        };

        notify(this.value);

        this.observers.push(
            notify
        );

        return (async function* () {
            while (is_receiving()) {
                yield await receiver();
            }
        })();
    }

    subscribe(): AsyncIterable<Result<T, ChannelError>> {
        return this.selecting_subscribe(structuredClone<T>);
    }

    update(mutator: (old_value: T) => T) {
        this.value = mutator(this.value);

        retain(
            this.observers,
            (observer) => {
                const result = observer(this.value);
                return "ok" in result;
            }
        );
    }
}

const score = new Observable(0);

export { score };