package com.aceleralock.blocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.widget.FrameLayout
import com.aceleralock.blocker.core.BlockDecider
import com.aceleralock.blocker.core.BlockOutcome
import com.aceleralock.blocker.core.BlockPolicy
import com.aceleralock.blocker.core.CorrectedClock
import com.aceleralock.blocker.core.CorrectedTime
import com.aceleralock.blocker.core.OfflineFailsafeCounter
import java.time.Instant

class BlockerService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var detector: ForegroundAppDetector
    private lateinit var overlay: OverlayPresenter
    private lateinit var criticalApps: CriticalAppResolver
    private lateinit var clock: CorrectedClock
    private lateinit var decider: BlockDecider
    private lateinit var failsafe: OfflineFailsafeCounter
    private lateinit var sync: SyncCoordinator

    @Volatile
    private var policy: BlockPolicy = BlockPolicy()

    @Volatile
    private var criticalPackages: Set<String> = emptySet()

    private var screenOn = true

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_ON, Intent.ACTION_USER_PRESENT -> {
                    screenOn = true
                    detector.resetWindow()
                    handler.removeCallbacks(pollLoop)
                    handler.post(pollLoop)
                    sync.requestIfStale()
                }

                Intent.ACTION_SCREEN_OFF -> screenOn = false
            }
        }
    }

    private val pollLoop = object : Runnable {
        override fun run() {
            runCatching { tick() }.onFailure { Log.w(TAG, "falha no tick", it) }
            handler.postDelayed(this, currentPollInterval())
        }
    }

    override fun onCreate() {
        super.onCreate()
        ProcessAffinityGuard.assertSameProcessAsApp(this)

        val store = EncryptedKeyValueStore(applicationContext)
        val monotonic = SystemMonotonicClock()
        detector = ForegroundAppDetector(this)
        overlay = OverlayPresenter(this)
        criticalApps = CriticalAppResolver(this)
        clock = CorrectedClock(monotonic, SystemWallClock())
        decider = BlockDecider(clock)
        failsafe = OfflineFailsafeCounter(store, monotonic).also { it.onBoot() }
        sync = SyncCoordinator(applicationContext, clock, failsafe) { fresh ->
            policy = fresh
        }

        criticalPackages = criticalApps.resolve()
        startForeground(BlockerTuning.NOTIFICATION_ID, buildNotification())
        registerReceiver(screenReceiver, IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_USER_PRESENT)
        })
        handler.post(pollLoop)
        sync.requestNow()
        ServiceWatchdog.schedule(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_REFRESH_CRITICAL -> criticalPackages = criticalApps.resolve()
            ACTION_REQUEST_SYNC -> sync.requestNow()
            ACTION_PUSH_TOKEN -> intent.getStringExtra(EXTRA_PUSH_TOKEN)?.let(sync::reportPushToken)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        failsafe.tick()
        handler.removeCallbacks(pollLoop)
        runCatching { unregisterReceiver(screenReceiver) }
        overlay.hide()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun tick() {
        failsafe.tick()
        sync.tickAndMaybeSync(screenOn)

        if (!screenOn) {
            overlay.hide()
            return
        }
        val foreground = detector.currentForegroundPackage() ?: return
        val verdict = decider.decide(foreground, policy, criticalPackages)

        if (verdict.outcome == BlockOutcome.BLOCK) {
            overlay.show(foreground) { context -> FrameLayout(context) }
        } else {
            overlay.hide()
        }
    }

    private fun currentPollInterval(): Long {
        if (overlay.currentlyShownFor() != null) {
            return BlockerTuning.POLL_WHILE_BLOCKING.toMillis()
        }
        val insideWindow = when (val now = clock.now()) {
            is CorrectedTime.Unanchored -> true
            is CorrectedTime.Anchored -> policy.profiles.any { it.isActiveAt(now.instant) }
        }
        return if (insideWindow) {
            BlockerTuning.POLL_INSIDE_WINDOW.toMillis()
        } else {
            BlockerTuning.POLL_OUTSIDE_WINDOW.toMillis()
        }
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    BlockerTuning.NOTIFICATION_CHANNEL_ID,
                    "Proteção ativa",
                    NotificationManager.IMPORTANCE_LOW
                )
            )
        }
        return Notification.Builder(this, BlockerTuning.NOTIFICATION_CHANNEL_ID)
            .setContentTitle("AceleraLock")
            .setContentText("Proteção ativa")
            .setOngoing(true)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .build()
    }

    companion object {
        private const val TAG = "BlockerService"
        private const val ACTION_REFRESH_CRITICAL = "com.aceleralock.blocker.REFRESH_CRITICAL"
        private const val ACTION_REQUEST_SYNC = "com.aceleralock.blocker.REQUEST_SYNC"
        private const val ACTION_PUSH_TOKEN = "com.aceleralock.blocker.PUSH_TOKEN"
        private const val EXTRA_PUSH_TOKEN = "pushToken"

        fun start(context: Context) {
            val intent = Intent(context, BlockerService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun refreshCriticalApps(context: Context) {
            val intent = Intent(context, BlockerService::class.java).setAction(ACTION_REFRESH_CRITICAL)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun requestSync(context: Context) {
            deliver(context, Intent(context, BlockerService::class.java).setAction(ACTION_REQUEST_SYNC))
        }

        fun reportPushToken(context: Context, token: String) {
            deliver(
                context,
                Intent(context, BlockerService::class.java)
                    .setAction(ACTION_PUSH_TOKEN)
                    .putExtra(EXTRA_PUSH_TOKEN, token)
            )
        }

        private fun deliver(context: Context, intent: Intent) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BlockerService::class.java))
        }
    }
}
