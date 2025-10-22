import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type MaskingOptions = Readonly<{
  maskTextInputs?: boolean;
  maskImages?: boolean;
  maskButtons?: boolean;
  maskLabels?: boolean;
  maskWebViews?: boolean;
  maskSandboxedViews?: boolean;
  quality?: number;
  scale?: number;
  noCaptureLabel?: string;
}>;

export interface Spec extends TurboModule {
  captureAndMask(): Promise<string>;
  captureAndMaskWithOptions(options: MaskingOptions): Promise<string>;
  startGestureRecording(): Promise<void>;
  stopGestureRecording(): Promise<void>;
  isGestureRecordingActive(): Promise<boolean>;
  recordGesture(
    gestureType: string,
    x: number,
    y: number,
    target?: string,
    metadata?: Object,
  ): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SessionRecorderNative') as Spec;
