package com.aceleralock.blocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.widget.FrameLayout
import com.aceleralock.blocker.core.BlockDecider
import com.aceleralock.blocker.core.BlockOutcome
import com.aceleralock.blocker.core.BlockPolicy
import com.aceleralock.blocker.core.GrantWindow
import com.aceleralock.blocker.core.PolicyRead
import com.aceleralock.blocker.core.PolicyReader
import com.aceleralock.blocker.core.RawPolicy
import com.aceleralock.blocker.core.WaitTarget
import com.aceleralock.blocker.core.WaitingPeriod
import org.json.JSONArray
import org.json.JSONObject

class BlockerService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var detector: ForegroundAppDetector
    private lateinit var overlay: OverlayPresenter
    private lateinit var criticalApps: CriticalAppResolver
    private lateinit var decider: BlockDecider
    private lateinit var waiting: WaitingPeriod
    private lateinit var grants: GrantWindow

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

        detector = ForegroundAppDetector(this)
        overlay = OverlayPresenter(this)
        criticalApps = CriticalAppResolver(this)
        decider = BlockDecider()
        waiting = WaitingPeriod(SharedPreferencesStore(this), SystemMonotonicClock)
        grants = GrantWindow(SharedPreferencesStore(this), SystemMonotonicClock, waiting::grantDuration)
        waiting.onBoot()
        grants.onBoot()

        applyPolicy(readPolicy(prefs()))
        criticalPackages = criticalApps.resolve()
        startForeground(BlockerTuning.NOTIFICATION_ID, buildNotification())
        registerReceiver(screenReceiver, IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_USER_PRESENT)
        })
        handler.post(pollLoop)
        ServiceWatchdog.schedule(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_REFRESH_CRITICAL -> criticalPackages = criticalApps.resolve()
            ACTION_REFRESH_POLICY -> applyPolicy(readPolicy(prefs()))
        }
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(pollLoop)
        runCatching { unregisterReceiver(screenReceiver) }
        overlay.hide()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun consumeMaturedWait() {
        when (val target = waiting.consumeIfReady()) {
            is WaitTarget.UnlockApp -> {
                grants.open(target.packageName)
                Log.i(TAG, "espera cumprida: concessao aberta")
            }

            is WaitTarget.StopProtection -> {
                Log.i(TAG, "espera cumprida: protecao desligada pelo usuario")
                stop(this)
            }

            is WaitTarget.ChangeDurations -> Log.i(TAG, "espera cumprida: novas duracoes em vigor")
            null -> Unit
        }
    }

    private fun applyPolicy(read: PolicyRead) {
        when (read) {
            is PolicyRead.Absent -> policy = BlockPolicy()
            is PolicyRead.Loaded -> policy = read.policy

            is PolicyRead.Unreadable -> Log.e(
                TAG,
                "politica ilegivel: mantendo a ultima conhecida (${policy.blockedPackages.size} alvos)"
            )
        }
    }

    /**
     * A espera e a concessao avancam mesmo com a tela apagada: o tempo passa do mesmo
     * jeito, e so o desenho do overlay depende da tela estar ligada.
     */
    private fun tick() {
        waiting.tick()
        grants.tick()
        consumeMaturedWait()

        if (!screenOn) {
            overlay.hide()
            return
        }
        val foreground = detector.currentForegroundPackage() ?: return
        val verdict = decider.decide(foreground, policy, criticalPackages, grants.activePackage())

        if (verdict.outcome == BlockOutcome.BLOCK) {
            overlay.show(foreground) { context -> FrameLayout(context) }
        } else {
            overlay.hide()
        }
    }

    private fun currentPollInterval(): Long =
        if (overlay.currentlyShownFor() != null) {
            BlockerTuning.POLL_WHILE_BLOCKING.toMillis()
        } else {
            BlockerTuning.POLL_OUTSIDE_WINDOW.toMillis()
        }

    private fun prefs(): SharedPreferences =
        applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

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
        const val PREFS_NAME = "aceleralock.blocker"
        const val KEY_POLICY = "policy.json"
        private const val ACTION_REFRESH_CRITICAL = "com.aceleralock.blocker.REFRESH_CRITICAL"
        private const val ACTION_REFRESH_POLICY = "com.aceleralock.blocker.REFRESH_POLICY"

        fun start(context: Context) {
            val intent = Intent(context, BlockerService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BlockerService::class.java))
        }

        fun refreshCriticalApps(context: Context) {
            val intent = Intent(context, BlockerService::class.java).setAction(ACTION_REFRESH_CRITICAL)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun refreshPolicy(context: Context) {
            val intent = Intent(context, BlockerService::class.java).setAction(ACTION_REFRESH_POLICY)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun writePolicy(context: Context, policy: BlockPolicy) {
            val json = JSONObject()
            json.put("blockedPackages", JSONArray(policy.blockedPackages.toList()))
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_POLICY, json.toString())
                .apply()
            refreshPolicy(context)
        }

        fun readPolicy(context: Context): PolicyRead =
            readPolicy(context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE))

        private fun readPolicy(prefs: SharedPreferences): PolicyRead =
            PolicyReader.read(prefs.getString(KEY_POLICY, null)) { raw ->
                val json = JSONObject(raw)
                val blocked = mutableListOf<String>()
                json.optJSONArray("blockedPackages")?.let { arr ->
                    for (i in 0 until arr.length()) blocked += arr.getString(i)
                }
                RawPolicy(blocked)
            }
    }
}
