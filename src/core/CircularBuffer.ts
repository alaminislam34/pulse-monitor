/**
 * A fast, memory-efficient Circular Buffer implementation.
 * It uses a fixed-size array to store items and overwrites the oldest items when the capacity is exceeded.
 */
export class CircularBuffer<T> {
  private buffer: Array<T | null>;
  private capacity: number;
  private head: number = 0; // Index of the oldest item
  private tail: number = 0; // Index where the next item will be written
  private size: number = 0; // Current number of items in the buffer

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be greater than 0");
    }
    this.capacity = capacity;
    this.buffer = new Array<T | null>(capacity).fill(null);
  }

  /**
   * Pushes a new item into the buffer. If the buffer is full,
   * it overwrites the oldest item.
   */
  public push(item: T): void {
    this.buffer[this.tail] = item;
    
    if (this.size < this.capacity) {
      this.tail = (this.tail + 1) % this.capacity;
      this.size++;
    } else {
      // Buffer is full. The oldest item (at head) is overwritten,
      // so we advance both head and tail.
      this.tail = (this.tail + 1) % this.capacity;
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Returns all items currently in the buffer, ordered from oldest to newest.
   */
  public toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[current];
      if (item !== null) {
        result.push(item);
      }
      current = (current + 1) % this.capacity;
    }
    return result;
  }

  /**
   * Returns the current number of elements stored.
   */
  public getSize(): number {
    return this.size;
  }

  /**
   * Returns the maximum capacity of the circular buffer.
   */
  public getCapacity(): number {
    return this.capacity;
  }

  /**
   * Clears all items in the circular buffer.
   */
  public clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}
