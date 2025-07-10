export interface IDebugSession {
  _id?: string
  shortId?: string
  name?: string
  metadata?: {
    userName?: string,
    userId?: string,
    accountName?: string,
    accountId?: string,
  } & object
  tags?: {
    key?: string
    value: string
  }[]
  userMetadata?: {
    email?: string
    notifyOnUpdates?: boolean
    comment?: string
  },
  clientMetadata?: object
}
