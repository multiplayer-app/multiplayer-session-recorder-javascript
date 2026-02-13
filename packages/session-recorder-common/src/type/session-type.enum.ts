export enum SessionType {
  CONTINUOUS = 'CONTINUOUS',
  /**
   * @deprecated Use MANUAL instead
   */
  PLAIN = 'MANUAL',
  /**
   * @description Manually triggered session recording
   */
  MANUAL = 'MANUAL',

  /**
   * @description Just for corellation without cache
   */
  SESSION = 'SESSION',
  /**
   * @description Correlation + caching
   */
  SESSION_CACHE = 'SESSION_CACHE',
}
