package com.agentic.pay.connectivitytest

import android.app.Service
import android.content.Intent
import android.os.IBinder

class HeartbeatService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        HeartbeatWorker.schedule(applicationContext)
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
