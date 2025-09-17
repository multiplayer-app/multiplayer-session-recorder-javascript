import React, { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Dimensions, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7

interface ModalContainerProps {
  isVisible: boolean
  onClose: () => void
  children: React.ReactNode
}

const ModalContainer: React.FC<ModalContainerProps> = ({ isVisible, onClose, children }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const [animatedFinished, setAnimatedFinished] = useState(false)

  const SWIPE_THRESHOLD = 100 // Distance to trigger close
  const MAX_SWIPE_DISTANCE = 200 // Maximum swipe distance

  const animateClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => {
      onClose()
    })
  }

  useEffect(() => {
    if (isVisible) {
      // Start from bottom and animate to position
      translateY.setValue(MODAL_HEIGHT)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start()
    }
  }, [isVisible, fadeAnim, translateY])

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateY.setValue(event.translationY)
    })
    .onEnd((event) => {
      const { translationY, velocityY } = event

      // If swiped down with sufficient distance or velocity, close modal
      if (translationY > SWIPE_THRESHOLD || velocityY > 500) {
        animateClose()
      } else {
        // Snap back to original position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8
        }).start()
      }
    })
    .activeOffsetY(10)
    .runOnJS(true)

  return (
    <>
      {isVisible && (
        <Animated.View style={{ ...styles.backdrop, opacity: fadeAnim }}>
          <Pressable style={styles.backdropPressable} onPress={animateClose} />
        </Animated.View>
      )}
      <Modal visible={isVisible} transparent animationType='none' onRequestClose={onClose}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.modal, { transform: [{ translateY }] }]}>
              <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  backdropPressable: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'auto',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  }
})

export default ModalContainer
