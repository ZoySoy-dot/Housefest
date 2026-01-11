"use server";
import Pusher from "pusher";
import { retain } from "./arrays"; // Assuming this file exists as per your code

// --- 1. Fix Pusher Configuration ---
// We explicitly check for keys to avoid the "Received undefined" error
const PUSHER_APP_ID = process.env.PUSHER_APP_ID || process.env.VITE_PUSHER_APP_ID;
const PUSHER_KEY = process.env.PUSHER_KEY || process.env.VITE_PUSHER_KEY;
const PUSHER_SECRET = process.env.PUSHER_SECRET || process.env.VITE_PUSHER_SECRET;
const PUSHER_CLUSTER = process.env.PUSHER_CLUSTER || process.env.VITE_PUSHER_CLUSTER;

// Only initialize Pusher if keys are present (prevents crash during build)
let pusher: Pusher | null = null;

if (PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER) {
    pusher = new Pusher({
        appId: PUSHER_APP_ID,
        key: PUSHER_KEY,
        secret: PUSHER_SECRET,
        cluster: PUSHER_CLUSTER,
        useTLS: true,
    });
} else {
    console.warn("⚠️ Pusher credentials missing. Real-time updates will not work.");
}

// --- 2. Your Existing Classes (Cleaned up) ---

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

        this.resolve = promise_resolve!;
        this.reject = promise_reject!;
    }
}

type Result<T, E> = { ok: T } | { error: E };
type ChannelError = "stopped_receiving";

type Channel<T> = {
    sender: (message: T) => Result<undefined, ChannelError>;
    receiver: () => Promise<Result<T, ChannelError>>;
    is_receiving: () => boolean;
    stop_receiving: () => void;
};

function channel<T>(): Channel<T> {
    let stopped_receiving = false;
    const messages: T[] = [];
    const message_waiters: Completer<Result<T, ChannelError>>[] = [];

    return {
        sender: (message: T) => {
            if (stopped_receiving) return { error: "stopped_receiving" };
            const waiter = message_waiters.shift();
            if (waiter !== undefined) {
                waiter.resolve({ ok: message });
                return { ok: undefined };
            }
            messages.push(message);
            return { ok: undefined };
        },
        receiver: async () => {
            if (stopped_receiving) return { error: "stopped_receiving" };
            const message = messages.shift();
            if (message !== undefined) return { ok: message };
            const waiter = new Completer<Result<T, ChannelError>>();
            message_waiters.push(waiter);
            return await waiter.promise;
        },
        is_receiving: () => !stopped_receiving,
        stop_receiving: () => {
            stopped_receiving = true;
            for (const waiter of message_waiters) {
                waiter.resolve({ error: "stopped_receiving" });
            }
        }
    };
}

class Observable<T> {
    readonly observers: ((updated: T) => Result<undefined, ChannelError>)[];

    constructor(private value: T) {
        this.observers = [];
    }

    get() {
        return this.value;
    }

    // --- 3. Added Pusher Trigger Logic Here ---
    async update(mutator: (old_value: T) => T) {
        this.value = mutator(this.value);

        // Notify local observers (your existing logic)
        retain(this.observers, (observer) => {
            const result = observer(this.value);
            return "ok" in result;
        });

        // Notify Pusher clients (The fix for real-time updates)
        if (pusher) {
            try {
                await pusher.trigger("score-channel", "score-update", {
                    score: this.value,
                });
                console.log(`[SERVER] Pusher updated. New score: ${this.value}`);
            } catch (err) {
                console.error("[SERVER] Pusher trigger failed:", err);
            }
        }
    }
}

// --- 4. Exported Server Actions ---

// Initialize global state
const scoreState = new Observable(0);

// Use this to get the score on initial page load
export async function getScore() {
    return scoreState.get();
}

// Use this to increment score from the client
export async function incrementScore(amount: number) {
    console.log("[SERVER] Incrementing by", amount);
    await scoreState.update((s) => s + amount);
    return scoreState.get();
}

// Use this to decrement score from the client
export async function decrementScore(amount: number) {
    console.log("[SERVER] Decrementing by", amount);
    await scoreState.update((s) => s - amount);
    return scoreState.get();
}
