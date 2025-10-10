import { type SessionRecorderOptions, WidgetButtonPlacement } from '../types';
import { BASE_CONFIG } from './defaults';
import { isValidBoolean, isValidEnum, isValidString } from './validators';

export const getWidgetConfig = (config: SessionRecorderOptions['widget']) => {
  const textOverrides = getTextOverridesConfig(
    config?.textOverrides,
    BASE_CONFIG.widget.textOverrides
  );

  const def = {
    enabled: true,
    button: { visible: true, placement: WidgetButtonPlacement.bottomRight },
    textOverrides,
  };

  const placementCandidate = config?.button?.placement || def.button.placement;

  return {
    textOverrides,
    enabled: isValidBoolean(config && config.enabled, def.enabled),
    button: {
      visible: isValidBoolean(
        config && config.button && config.button.visible,
        def.button.visible
      ),
      placement: isValidEnum<WidgetButtonPlacement>(
        placementCandidate,
        def.button.placement,
        Object.values(WidgetButtonPlacement)
      ),
    },
  };
};

const getTextOverridesConfig = (config: any, defaultConfig: any) => {
  if (!config || typeof config !== 'object') {
    return defaultConfig;
  }
  return Object.keys(defaultConfig).reduce(
    (acc, key) => {
      acc[key] = isValidString(config[key], defaultConfig[key]);
      return acc;
    },
    {} as Record<string, unknown>
  );
};
