import { SessionRecorderOptions, WidgetButtonPlacement } from "../types"
import { isValidBoolean, isValidEnum } from "./validators"

export const getWidgetConfig = (config: SessionRecorderOptions['widget']) => {

  const def = {
    enabled: true,
    button: { visible: true, placement: WidgetButtonPlacement.bottomRight },
  }

  const placementCandidate = config?.button?.placement || def.button.placement

  return {
    enabled: isValidBoolean(config && config.enabled, def.enabled),
    button: {
      visible: isValidBoolean(config && config.button && config.button.visible, def.button.visible),
      placement: isValidEnum<WidgetButtonPlacement>(
        placementCandidate,
        def.button.placement,
        Object.values(WidgetButtonPlacement)
      ),
    },
  }
}