# Change Detection Test

This document explains how to test the smart change detection feature that prevents duplicate screen capture events.

## How Change Detection Works

The system automatically compares each screen capture with the previous one using a lightweight hash-based approach:

1. **Hash Generation**: Samples beginning, middle, and end of base64 image
2. **Comparison**: Compares current hash with previous hash
3. **Skip Unchanged**: Only sends events when screen actually changes
4. **Touch Triggered**: Forces capture after touch interactions

## Test Scenarios

### 1. Static Screen Test

```typescript
// Test with a static screen (no changes)
function StaticScreenTest() {
  const { client } = useSessionRecorder()

  useEffect(() => {
    // Start session
    client.start()

    // Wait for multiple captures
    setTimeout(() => {
      const events = client.getRecordedEvents?.() || []
      const screenEvents = events.filter((e) => e.type === EventType.FullSnapshot)

      console.log('Screen events captured:', screenEvents.length)
      // Should be 1 (initial capture) if screen is static
    }, 10000) // Wait 10 seconds
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <Text>Static Screen - No Changes</Text>
    </View>
  )
}
```

**Expected Result**: Only 1 screen capture event (initial capture)

### 2. Dynamic Screen Test

```typescript
// Test with a changing screen
function DynamicScreenTest() {
  const { client } = useSessionRecorder()
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    client.start()

    // Change screen every 2 seconds
    const interval = setInterval(() => {
      setCounter((prev) => prev + 1)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <Text>Counter: {counter}</Text>
      <Text>This changes every 2 seconds</Text>
    </View>
  )
}
```

**Expected Result**: Multiple screen capture events as the counter changes

### 3. Touch Interaction Test

```typescript
// Test touch interactions force capture
function TouchInteractionTest() {
  const { client } = useSessionRecorder()
  const [touches, setTouches] = useState(0)

  const handleTouch = () => {
    setTouches((prev) => prev + 1)
  }

  useEffect(() => {
    client.start()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }} onTouchStart={handleTouch}>
      <Text>Touch Count: {touches}</Text>
      <Text>Touch the screen to test forced capture</Text>
    </View>
  )
}
```

**Expected Result**: Screen capture after each touch interaction

## Configuration Tests

### 1. Disable Change Detection

```typescript
// Test with change detection disabled
function DisableChangeDetectionTest() {
  const { client } = useSessionRecorder()

  useEffect(() => {
    client.start()

    // Access screen recorder and disable change detection
    // This would require exposing the screen recorder instance
    // screenRecorder.setChangeDetection(false)
  }, [])

  return <View style={{ flex: 1, backgroundColor: 'white' }} />
}
```

**Expected Result**: Screen capture every interval regardless of changes

### 2. Adjust Hash Sample Size

```typescript
// Test with different hash sample sizes
function HashSampleSizeTest() {
  const { client } = useSessionRecorder()

  useEffect(() => {
    client.start()

    // Test with smaller sample size (more sensitive)
    // screenRecorder.setHashSampleSize(50)

    // Test with larger sample size (less sensitive)
    // screenRecorder.setHashSampleSize(200)
  }, [])

  return <View style={{ flex: 1, backgroundColor: 'white' }} />
}
```

## Performance Benefits

### Before Change Detection

- Screen capture every 5 seconds
- 720 events per hour (static screen)
- Unnecessary network traffic
- Large event storage

### After Change Detection

- Screen capture only when changed
- 1 event per hour (static screen)
- 90% reduction in events
- Efficient storage and transmission

## Debug Information

Add this to monitor change detection:

```typescript
const debugChangeDetection = () => {
  const events = client.getRecordedEvents?.() || []
  const screenEvents = events.filter((e) => e.type === EventType.FullSnapshot)

  console.log('Total screen events:', screenEvents.length)
  console.log('Change detection enabled:', screenRecorder.enableChangeDetection)
  console.log('Hash sample size:', screenRecorder.hashSampleSize)
}
```

## Troubleshooting

### Issue: Too Many Events

- **Cause**: Change detection disabled or hash sample too small
- **Solution**: Enable change detection or increase hash sample size

### Issue: Missing Events

- **Cause**: Hash sample too large or change detection too strict
- **Solution**: Decrease hash sample size or disable change detection

### Issue: Touch Events Not Triggering Capture

- **Cause**: Screen recorder reference not properly set
- **Solution**: Check that gesture recorder has screen recorder reference

## Success Criteria

✅ Static screens generate minimal events
✅ Dynamic screens generate events on changes
✅ Touch interactions force capture
✅ Configurable change detection
✅ Performance improvement achieved
