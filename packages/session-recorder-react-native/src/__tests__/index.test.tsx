import { EventType } from '@rrweb/types';
import { ScreenRecorder } from '../recorder/screenRecorder';
import { type RecorderConfig } from '../types';

const mockCaptureMaskedScreen = jest.fn<Promise<string | null>, any[]>();
const mockIsScreenRecordingAvailable = jest.fn<boolean, any[]>();
const mockUpdateConfig = jest.fn<void, any[]>();

jest.mock('../services/screenRecordingService', () => ({
  screenRecordingService: {
    captureMaskedScreen: (...args: any[]) => mockCaptureMaskedScreen(...args),
    isScreenRecordingAvailable: (...args: any[]) =>
      mockIsScreenRecordingAvailable(...args),
    updateConfig: (...args: any[]) => mockUpdateConfig(...args),
  },
}));

const baseConfig: RecorderConfig = {
  apiKey: 'k',
  apiBaseUrl: 'https://example.com',
  exporterEndpoint: 'https://example.com/otel',
  recordScreen: true,
  recordGestures: false,
  recordNavigation: false,
  masking: {},
  buffering: {
    enabled: true,
    windowMinutes: 0.5,
    snapshotIntervalMs: 5000,
  },
} as any;

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('ScreenRecorder buffering snapshots', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCaptureMaskedScreen.mockReset();
    mockIsScreenRecordingAvailable.mockReset();
    mockUpdateConfig.mockReset();
    mockIsScreenRecordingAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates periodic full snapshots in buffer-only mode', async () => {
    mockCaptureMaskedScreen
      .mockResolvedValueOnce('img-a')
      .mockResolvedValueOnce('img-b')
      .mockResolvedValueOnce('img-c');

    const emitted: any[] = [];
    const recorder = new ScreenRecorder();
    recorder.init(baseConfig, {
      recordEvent: (event: any) => emitted.push(event),
    } as any);
    recorder.setBufferOnlyMode(true);
    recorder.start();

    await flushMicrotasks();
    const initialFullSnapshots = emitted.filter(
      (e) => e.type === EventType.FullSnapshot
    ).length;
    expect(initialFullSnapshots).toBe(1);

    jest.advanceTimersByTime(5200);
    await flushMicrotasks();

    const fullSnapshotsAfterInterval = emitted.filter(
      (e) => e.type === EventType.FullSnapshot
    ).length;
    expect(fullSnapshotsAfterInterval).toBeGreaterThan(1);

    const metaEventsAfterInterval = emitted.filter(
      (e) => e.type === EventType.Meta
    ).length;
    expect(metaEventsAfterInterval).toBeGreaterThan(1);
  });

  it('uses incremental updates between forced full snapshots', async () => {
    mockCaptureMaskedScreen
      .mockResolvedValueOnce('img-1')
      .mockResolvedValueOnce('img-2');

    const emitted: any[] = [];
    const recorder = new ScreenRecorder();
    recorder.init(baseConfig, {
      recordEvent: (event: any) => emitted.push(event),
    } as any);
    recorder.setBufferOnlyMode(true);
    recorder.start();

    await flushMicrotasks();

    recorder.forceCapture();
    await flushMicrotasks();

    const hasIncremental = emitted.some(
      (e) => e.type === EventType.IncrementalSnapshot
    );
    expect(hasIncremental).toBe(true);
  });
});
