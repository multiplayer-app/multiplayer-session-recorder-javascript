import React, { useEffect, useRef, useState } from 'react'
import { Animated, View, Pressable, StyleSheet, Dimensions, Modal } from 'react-native'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7

interface ModalContainerProps {
  isVisible: boolean
  onClose: () => void
  children: React.ReactNode
}

const ModalContainer: React.FC<ModalContainerProps> = ({ isVisible, onClose, children }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [animatedFinished, setAnimatedFinished] = useState(false)

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true
    }).start()
  }, [isVisible, fadeAnim])

  return (
    <>
      {isVisible && (
        <Animated.View style={{ ...styles.backdrop, opacity: fadeAnim }}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>
      )}
      <Modal visible={isVisible} transparent animationType='slide' onRequestClose={onClose}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          {children}
        </View>
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
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8
  }
})

export default ModalContainer
