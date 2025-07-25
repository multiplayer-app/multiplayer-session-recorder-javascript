import pkg from '../package.json';

export const MULTIPLAYER_BASE_API_URL = process.env.MULTIPLAYER_BASE_API_URL || 'https://api.multiplayer.app'

export const SESSION_RECORDER_VERSION = process.env.SESSION_RECORDER_VERSION || pkg.version
