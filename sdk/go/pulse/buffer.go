package pulse

import "sync"

// CircularBuffer is a thread-safe ring buffer with fixed capacity.
type CircularBuffer[T any] struct {
	mu       sync.RWMutex
	capacity int
	buffer   []T
	head     int
	size     int
}

// NewCircularBuffer initializes a CircularBuffer with the given maximum capacity.
func NewCircularBuffer[T any](capacity int) *CircularBuffer[T] {
	if capacity <= 0 {
		capacity = 1000
	}
	return &CircularBuffer[T]{
		capacity: capacity,
		buffer:   make([]T, capacity),
		head:     0,
		size:     0,
	}
}

// Push adds an item to the buffer, overwriting the oldest item if full.
func (cb *CircularBuffer[T]) Push(item T) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.buffer[cb.head] = item
	cb.head = (cb.head + 1) % cb.capacity
	if cb.size < cb.capacity {
		cb.size++
	}
}

// ToArray returns all items from oldest to newest.
func (cb *CircularBuffer[T]) ToArray() []T {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	result := make([]T, cb.size)
	if cb.size == 0 {
		return result
	}

	start := 0
	if cb.size == cb.capacity {
		start = cb.head
	}

	for i := 0; i < cb.size; i++ {
		idx := (start + i) % cb.capacity
		result[i] = cb.buffer[idx]
	}

	return result
}

// Size returns the current number of items.
func (cb *CircularBuffer[T]) Size() int {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.size
}

// Clear empties the buffer.
func (cb *CircularBuffer[T]) Clear() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.head = 0
	cb.size = 0
	cb.buffer = make([]T, cb.capacity)
}
