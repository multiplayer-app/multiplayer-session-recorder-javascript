import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { sharedStyles } from './styles';
import { LogoIcon } from './icons';

interface ModalHeaderProps {
  children?: React.ReactNode;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ children }) => {
  return (
    <View style={sharedStyles.popoverHeader}>
      <View style={sharedStyles.modalHandle} />
      <View style={sharedStyles.popoverHeaderContent}>
        <Pressable
          onPress={() => Linking.openURL('https://www.multiplayer.app')}
        >
          <LogoIcon size={42} />
        </Pressable>
        {children}
      </View>
    </View>
  );
};

export default ModalHeader;
