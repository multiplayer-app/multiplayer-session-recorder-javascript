package com.multiplayer.sessionrecorder

import android.view.View

/**
 * Utility class for marking views as sensitive/masked
 * Provides methods to mark native Android views as sensitive
 */
public object SessionRecorderMaskModifier {

    /**
     * Mark a view as sensitive/masked by setting its tag
     * @param view The view to mark as sensitive
     * @param isEnabled If true, the view will be masked. If false, removes the mask tag.
     */
    public fun View.setMasked(isEnabled: Boolean = true) {
        if (isEnabled) {
            this.tag = "no-capture"
        } else {
            this.tag = null
        }
    }

    /**
     * Mark a view as sensitive/masked by setting its contentDescription
     * @param view The view to mark as sensitive
     * @param isEnabled If true, the view will be masked. If false, removes the mask contentDescription.
     */
    public fun View.setMaskedByContentDescription(isEnabled: Boolean = true) {
        if (isEnabled) {
            this.contentDescription = "no-capture"
        } else {
            this.contentDescription = null
        }
    }

    /**
     * Check if a view is explicitly marked as sensitive/masked
     * @param view The view to check
     * @param noCaptureLabel The label used to identify masked views
     * @return true if the view should be masked
     */
    public fun View.isExplicitlyMasked(noCaptureLabel: String = "no-capture"): Boolean {
        return (tag as? String)?.lowercase()?.contains(noCaptureLabel.lowercase()) == true ||
               contentDescription?.toString()?.lowercase()?.contains(noCaptureLabel.lowercase()) == true
    }
}
