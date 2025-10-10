package com.multiplayer.sessionrecordernative.util

import android.graphics.PointF
import android.view.View
import android.view.ViewGroup
import android.widget.*
import com.multiplayer.sessionrecordernative.model.TargetInfo

object ViewUtils {
  fun findTargetView(point: PointF, rootView: ViewGroup?): TargetInfo {
    if (rootView == null) {
      return TargetInfo("unknown", null, null, null, null)
    }

    val targetView =
            findViewAtPoint(point, rootView) ?: return TargetInfo("unknown", null, null, null, null)

    val identifier =
            targetView.contentDescription?.toString()
                    ?: targetView.tag?.toString() ?: "view-${targetView.hashCode()}"

    val label = targetView.contentDescription?.toString()
    val role = getAccessibilityRole(targetView)
    val testId = targetView.tag?.toString()

    val text =
            when (targetView) {
              is TextView -> targetView.text?.toString()
              is Button -> targetView.text?.toString()
              is EditText -> targetView.text?.toString() ?: targetView.hint?.toString()
              else -> null
            }

    return TargetInfo(identifier, label, role, testId, text)
  }

  private fun findViewAtPoint(point: PointF, viewGroup: ViewGroup): View? {
    for (i in viewGroup.childCount - 1 downTo 0) {
      val child = viewGroup.getChildAt(i)
      if (child.visibility == View.VISIBLE && child.alpha > 0.01f) {
        val location = IntArray(2)
        child.getLocationOnScreen(location)
        val childRect =
                android.graphics.Rect(
                        location[0],
                        location[1],
                        location[0] + child.width,
                        location[1] + child.height
                )

        if (childRect.contains(point.x.toInt(), point.y.toInt())) {
          return if (child is ViewGroup) {
            findViewAtPoint(point, child) ?: child
          } else {
            child
          }
        }
      }
    }
    return null
  }

  private fun getAccessibilityRole(view: View): String? {
    return when (view) {
      is Button -> "button"
      is EditText -> "textbox"
      is ImageView -> "image"
      is TextView -> "text"
      else -> null
    }
  }
}
