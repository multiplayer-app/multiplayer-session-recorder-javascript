import React, { useRef, useEffect, useMemo } from 'react'
import { StyleSheet, Platform, Animated, PanResponder, View, Dimensions } from 'react-native'
import { SessionState } from '../../types'
import { StorageService } from '../../services/storage.service'
import { RecordIcon, CapturingIcon, PausedIcon } from './icons'

interface FloatingButtonProps {
  sessionState: SessionState | null
  onPress: () => void
}
const buttonSize = 52 // Browser version: 42px x 42px
const rightOffset = 20
const topOffset = Platform.OS === 'ios' ? 60 : 40

const FloatingButton: React.FC<FloatingButtonProps> = ({ sessionState, onPress }) => {
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current // For tracking position
  const lastPosition = useRef({ top: topOffset, right: rightOffset }) // Track the last saved position
  const storageService = useRef(StorageService.getInstance()).current // Singleton instance

  const screenBounds = useMemo(() => {
    const { width, height } = Dimensions.get('window')

    return {
      minTop: topOffset, // Account for status bar
      maxTop: height - buttonSize,
      minRight: 0,
      maxRight: width - buttonSize
    }
  }, [])

  // Load saved position on component mount
  useEffect(() => {
    const savedPosition = storageService.getFloatingButtonPosition()
    if (savedPosition) {
      // Convert from x,y coordinates to top,right coordinates
      const { width, height } = Dimensions.get('window')
      const top = savedPosition.y
      const right = width - savedPosition.x - buttonSize
      lastPosition.current = { top, right }
      position.setValue({ x: right, y: top })
    } else {
      // Set default position
      position.setValue({ x: lastPosition.current.right, y: lastPosition.current.top })
    }
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only start dragging if movement is significant enough
        const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy)
        return distance > 5
      },
      onPanResponderGrant: () => {
        // Set the initial position for this gesture
        position.setValue({ x: lastPosition.current.right, y: lastPosition.current.top })
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate new position based on gesture movement
        const newTop = lastPosition.current.top + gestureState.dy
        const newRight = lastPosition.current.right - gestureState.dx // Invert dx for right positioning

        // Update position during drag
        position.setValue({ x: newRight, y: newTop })
      },
      onPanResponderRelease: (e, gestureState) => {
        // Check if this was actually a drag (significant movement)
        const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy)

        // If it was a tap (no significant movement), trigger onPress
        if (distance <= 5) {
          onPress()
        } else {
          // Calculate new position after dragging
          const newTop = lastPosition.current.top + gestureState.dy
          const newRight = lastPosition.current.right - gestureState.dx // Invert dx for right positioning

          // Clamp to screen bounds
          const clampedTop = Math.max(screenBounds.minTop, Math.min(screenBounds.maxTop, newTop))
          const clampedRight = Math.max(screenBounds.minRight, Math.min(screenBounds.maxRight, newRight))

          // Update position
          lastPosition.current = { top: clampedTop, right: clampedRight }
          position.setValue({ x: clampedRight, y: clampedTop })

          // Convert back to x,y coordinates for storage
          const { width } = Dimensions.get('window')
          const storagePosition = {
            x: width - clampedRight - buttonSize,
            y: clampedTop
          }

          // Persist position to AsyncStorage (debounced)
          storageService.saveFloatingButtonPosition(storagePosition)
        }
      }
    })
  ).current

  // Memoized button icon and color for performance
  const buttonIcon = useMemo(() => {
    switch (sessionState) {
      case SessionState.started:
        return <CapturingIcon size={28} color='white' />
      case SessionState.paused:
        return <PausedIcon size={28} color='white' />
      default:
        return <RecordIcon size={28} color='#718096' />
    }
  }, [sessionState])

  const buttonColor = useMemo(() => {
    switch (sessionState) {
      case SessionState.started:
        return '#FF4444' // Browser primary color when recording
      case SessionState.paused:
        return '#FFA500'
      default:
        return '#ffffff' // Browser default white background
    }
  }, [sessionState])

  return (
    <Animated.View style={[styles.draggableButton, { top: position.y, right: position.x }]} {...panResponder.panHandlers}>
      <View style={[styles.floatingButton, { backgroundColor: buttonColor }]}>{buttonIcon}</View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  draggableButton: {
    position: 'absolute'
  },
  floatingButton: {
    elevation: 8,
    shadowRadius: 4,
    width: buttonSize,
    shadowColor: '#000',
    height: buttonSize,
    shadowOpacity: 0.25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: buttonSize / 2,
    shadowOffset: { width: 0, height: 2 }
  }
})

export default FloatingButton
