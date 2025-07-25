import { context, trace } from '@opentelemetry/api'
import { 
    ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE,
    ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE_REASON
 } from '../constants.base'
/**
 * @description Set auto save attribute to span
 * @param {String} reason 
 * @returns {void}
 */
export const saveContinuousSession = (
    reason?: string
) => {
    const span = trace.getSpan(context.active())

    if (!span) {
        return
        // create span
    }

    span?.setAttribute(ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE, true)

    if (reason?.length) {
        span?.addEvent(ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE_REASON, {
            reason
        })
    }
}
