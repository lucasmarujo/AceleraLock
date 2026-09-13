package com.aceleralock.blocker

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings

data class PermissionState(
    val usageAccess: Boolean,
    val overlay: Boolean,
    val batteryExempt: Boolean,
    val notifications: Boolean,
    val accessibility: Boolean
) {
    /**
     * A1 + A2 sao as essenciais: sem elas o app nao bloqueia nada. Acessibilidade
     * fica de fora: sem ela so o bloqueio de sites para, e os apps seguem bloqueados.
     */
    val coreGranted: Boolean get() = usageAccess && overlay
}

class PermissionProbe(private val context: Context) {

    fun probe(): PermissionState = PermissionState(
        usageAccess = hasUsageAccess(),
        overlay = Settings.canDrawOverlays(context),
        batteryExempt = isIgnoringBatteryOptimizations(),
        notifications = hasNotificationPermission(),
        accessibility = isSiteAccessibilityEnabled()
    )

    private fun isSiteAccessibilityEnabled(): Boolean {
        val habilitados = Settings.Secure.getString(
            context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val nosso = ComponentName(context, SiteAccessibilityService::class.java)
        return habilitados.split(':').any { ComponentName.unflattenFromString(it) == nosso }
    }

    private fun hasUsageAccess(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    private fun hasNotificationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true
        }
        return context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }
}
