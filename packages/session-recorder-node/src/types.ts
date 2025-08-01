export interface ISession {
  _id?: string
  shortId?: string
  name?: string
  resourceAttributes?: {
    browserInfo?: string,
    cookiesEnabled?: string,
    deviceInfo?: string,
    hardwareConcurrency?: string,
    osInfo?: string,
    pixelRatio?: string,
    screenSize?: string,
  } & any
  sessionAttributes?: {
    userEmail?: string
    userId?: string,
    userName?: string,
    accountId?: string,
    accountName?: string,

    comment?: string
  } & any
  tags?: {
    key?: string
    value: string
  }[]
}
