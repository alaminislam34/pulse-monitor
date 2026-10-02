export { M as Monitor, a as MonitorConfig, R as RequestMetrics, S as SecurityAlert, T as ThreatDetector } from './Monitor-nmLtlnC9.mjs';

/**
 * A fast, memory-efficient Circular Buffer implementation.
 * It uses a fixed-size array to store items and overwrites the oldest items when the capacity is exceeded.
 */
declare class CircularBuffer<T> {
    private buffer;
    private capacity;
    private head;
    private tail;
    private size;
    constructor(capacity: number);
    /**
     * Pushes a new item into the buffer. If the buffer is full,
     * it overwrites the oldest item.
     */
    push(item: T): void;
    /**
     * Returns all items currently in the buffer, ordered from oldest to newest.
     */
    toArray(): T[];
    /**
     * Returns the current number of elements stored.
     */
    getSize(): number;
    /**
     * Returns the maximum capacity of the circular buffer.
     */
    getCapacity(): number;
    /**
     * Clears all items in the circular buffer.
     */
    clear(): void;
}

export { CircularBuffer };
