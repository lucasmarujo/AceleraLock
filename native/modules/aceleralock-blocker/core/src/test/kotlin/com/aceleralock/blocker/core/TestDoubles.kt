package com.aceleralock.blocker.core

class FakeMonotonicClock(private var elapsed: Long = 0L) : MonotonicClock {
    override fun elapsedMillis(): Long = elapsed

    fun advance(millis: Long) {
        elapsed += millis
    }

    /** Reboot: elapsedRealtime volta a zero. */
    fun reboot() {
        elapsed = 0L
    }
}

class FakeWallClock(var millis: Long) : WallClock {
    override fun nowMillis(): Long = millis

    fun jumpForward(millis: Long) {
        this.millis += millis
    }
}

class InMemoryStore : KeyValueStore {
    private val longs = mutableMapOf<String, Long>()
    private val ints = mutableMapOf<String, Int>()

    override fun getLong(key: String, fallback: Long): Long = longs[key] ?: fallback

    override fun putLong(key: String, value: Long) {
        longs[key] = value
    }

    override fun getInt(key: String, fallback: Int): Int = ints[key] ?: fallback

    override fun putInt(key: String, value: Int) {
        ints[key] = value
    }
}
