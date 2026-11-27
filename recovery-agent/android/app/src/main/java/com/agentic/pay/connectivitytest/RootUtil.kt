package com.agentic.pay.connectivitytest

import android.content.Context
import android.content.pm.PackageManager
import java.io.File

object RootUtil {
    private const val TAG = "RootUtil"

    fun isRooted(context: Context): Boolean {
        return checkBuildTags() || checkSuBinary() || checkRootApps(context) || checkRootFiles()
    }

    private fun checkBuildTags(): Boolean {
        val buildTags = android.os.Build.TAGS
        return buildTags != null && buildTags.contains("test-keys")
    }

    private fun checkSuBinary(): Boolean {
        val suPaths = arrayOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/system/su", "/system/bin/.ext/su", "/usr/bin/su",
            "/data/local/xbin/su", "/data/local/bin/su", "/data/local/su",
        )
        return suPaths.any { File(it).exists() }
    }

    private fun checkRootApps(context: Context): Boolean {
        val rootPackages = arrayOf(
            "com.noshufou.android.su", "com.noshufou.android.su.elite",
            "com.koushikdutta.superuser", "com.thirdparty.superuser",
            "com.yellowes.su", "com.topjohnwu.magisk",
        )
        val pm = context.packageManager
        return rootPackages.any { pkg ->
            try {
                pm.getPackageInfo(pkg, PackageManager.GET_ACTIVITIES)
                true
            } catch (e: PackageManager.NameNotFoundException) {
                false
            }
        }
    }

    private fun checkRootFiles(): Boolean {
        val rootFiles = arrayOf(
            "/system/app/Superuser.apk", "/sbin/su", "/system/bin/su",
            "/system/xbin/su", "/data/local/xbin/su", "/data/local/bin/su",
            "/system/sd/xbin/su", "/system/bin/failsafe/su",
        )
        return rootFiles.any { File(it).exists() }
    }
}
