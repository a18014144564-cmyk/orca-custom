package expo.modules.orcareservedregions

import android.app.Activity
import android.os.Handler
import android.os.Looper
import androidx.core.util.Consumer
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executor
import kotlin.math.max

/**
 * Bridges Android Jetpack WindowManager FoldingFeature updates (e.g. Honor Magic V6 flat unfolded,
 * half-opened tabletop/book postures, and physical hinge bounds) into Orca's ReservedRegions stream.
 */
class OrcaReservedRegionsModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val mainExecutor = Executor { runnable ->
    if (Looper.myLooper() == Looper.getMainLooper()) {
      runnable.run()
    } else {
      mainHandler.post(runnable)
    }
  }

  private var trackerAdapter: WindowInfoTrackerCallbackAdapter? = null
  private var layoutConsumer: Consumer<WindowLayoutInfo>? = null
  private var observedActivity: Activity? = null
  private var observing = false

  @Volatile
  private var latestPayload: Map<String, Any> = emptyPayload()

  override fun definition() = ModuleDefinition {
    Name("OrcaReservedRegions")
    Events("onChange")

    Function("getCurrentRegions") {
      latestPayload
    }

    OnStartObserving {
      observing = true
      attachToCurrentActivity()
    }

    OnStopObserving {
      observing = false
      detachListener()
    }

    OnActivityEntersForeground {
      if (observing) {
        attachToCurrentActivity()
      }
    }

    OnDestroy {
      observing = false
      detachListener()
    }
  }

  private fun attachToCurrentActivity() {
    val activity = appContext.currentActivity ?: return
    if (observedActivity === activity && layoutConsumer != null) {
      return
    }
    detachListener()
    try {
      val adapter = WindowInfoTrackerCallbackAdapter(WindowInfoTracker.getOrCreate(activity))
      val consumer = Consumer<WindowLayoutInfo> { layoutInfo ->
        val payload = buildPayload(activity, layoutInfo)
        latestPayload = payload
        if (observing) {
          sendEvent("onChange", payload)
        }
      }
      adapter.addWindowLayoutInfoListener(activity, mainExecutor, consumer)
      trackerAdapter = adapter
      layoutConsumer = consumer
      observedActivity = activity
    } catch (_: Throwable) {
      // Devices without WindowManager extensions fall back cleanly to window dimensions.
    }
  }

  private fun detachListener() {
    val adapter = trackerAdapter
    val consumer = layoutConsumer
    if (adapter != null && consumer != null) {
      try {
        adapter.removeWindowLayoutInfoListener(consumer)
      } catch (_: Throwable) {
        // Ignore teardown races when Activity is already finishing.
      }
    }
    trackerAdapter = null
    layoutConsumer = null
    observedActivity = null
  }

  private fun buildPayload(activity: Activity, info: WindowLayoutInfo): Map<String, Any> {
    val density = max(activity.resources.displayMetrics.density, 1f)
    val feature = info.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull()
      ?: return emptyPayload()

    val bounds = feature.bounds
    val isVertical = feature.orientation == FoldingFeature.Orientation.VERTICAL
    val rawX = bounds.left / density
    val rawY = bounds.top / density
    val rawW = bounds.width() / density
    val rawH = bounds.height() / density

    // Zero-thickness crease still reports exact axis center; give a 12dp safe band for layout avoidance.
    val minSafeBand = 12f
    val divW = if (isVertical && rawW < minSafeBand) minSafeBand else rawW
    val divH = if (!isVertical && rawH < minSafeBand) minSafeBand else rawH
    val divX = if (isVertical && rawW < minSafeBand) max(0f, rawX - (divW - rawW) / 2f) else rawX
    val divY = if (!isVertical && rawH < minSafeBand) max(0f, rawY - (divH - rawH) / 2f) else rawY

    val posture = when (feature.state) {
      FoldingFeature.State.HALF_OPENED -> "half-opened"
      FoldingFeature.State.FLAT -> "flat"
      else -> "none"
    }
    val orientation = when (feature.orientation) {
      FoldingFeature.Orientation.VERTICAL -> "vertical"
      FoldingFeature.Orientation.HORIZONTAL -> "horizontal"
      else -> "none"
    }

    val division = mapOf(
      "x" to divX.toDouble(),
      "y" to divY.toDouble(),
      "width" to divW.toDouble(),
      "height" to divH.toDouble()
    )

    return mapOf(
      "divisions" to listOf(division),
      "hasFoldDivision" to true,
      "occlusions" to emptyList<Map<String, Any>>(),
      "foldPosture" to posture,
      "foldOrientation" to orientation,
      "foldSeparating" to feature.isSeparating
    )
  }

  private fun emptyPayload(): Map<String, Any> = mapOf(
    "divisions" to emptyList<Map<String, Any>>(),
    "hasFoldDivision" to false,
    "occlusions" to emptyList<Map<String, Any>>(),
    "foldPosture" to "none",
    "foldOrientation" to "none",
    "foldSeparating" to false
  )
}
