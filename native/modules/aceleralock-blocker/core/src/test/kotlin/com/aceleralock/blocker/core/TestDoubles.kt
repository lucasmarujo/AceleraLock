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

class InMemoryStore : KeyValueStore {
    private val longs = mutableMapOf<String, Long>()
    private val ints = mutableMapOf<String, Int>()
    private val strings = mutableMapOf<String, String>()

    override fun getLong(key: String, fallback: Long): Long = longs[key] ?: fallback

    override fun putLong(key: String, value: Long) {
        longs[key] = value
    }

    override fun getInt(key: String, fallback: Int): Int = ints[key] ?: fallback

    override fun putInt(key: String, value: Int) {
        ints[key] = value
    }

    override fun getString(key: String): String? = strings[key]

    override fun putString(key: String, value: String?) {
        if (value == null) {
            strings.remove(key)
        } else {
            strings[key] = value
        }
    }
}

class FakeWallClock(
    private var day: java.time.LocalDate = java.time.LocalDate.of(2026, 8, 30),
    private var now: Long = 0L
) : WallClock {
    override fun today(): java.time.LocalDate = day

    override fun nowMillis(): Long = now

    fun setToday(value: java.time.LocalDate) {
        day = value
    }
}
