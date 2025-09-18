package com.multiplayer.sessionrecorder

/**
 * Configuration class for Session Recorder masking behavior
 */
public class SessionRecorderConfig
    @JvmOverloads
    constructor(
        /**
         * Enable masking of text input fields (EditText)
         * Defaults to true
         */
        public var maskTextInputs: Boolean = true,

        /**
         * Enable masking of images to a placeholder
         * Defaults to false
         */
        public var maskImages: Boolean = false,

        /**
         * Enable masking of buttons
         * Defaults to false
         */
        public var maskButtons: Boolean = false,

        /**
         * Enable masking of web views
         * Defaults to false
         */
        public var maskWebViews: Boolean = false,

        /**
         * Image quality for screenshots (0.1f = 10% quality, 1.0f = 100% quality)
         * Defaults to 0.1f for smaller file sizes
         */
        public var imageQuality: Float = 0.1f,

        /**
         * Label used to identify views that should be explicitly masked
         * Views with this tag or contentDescription will be masked regardless of other settings
         * Defaults to "no-capture"
         */
        public var noCaptureLabel: String = "no-capture",
    )
