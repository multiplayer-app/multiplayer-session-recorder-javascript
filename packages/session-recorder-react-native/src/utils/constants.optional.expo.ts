// Expo variant: re-export expo-constants default to be consumed via the optional shim path
import Constants from 'expo-constants'
import type { OptionalExpoConstants } from './constants.optional'

export default Constants as OptionalExpoConstants
