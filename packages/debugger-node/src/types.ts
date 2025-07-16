export interface IDebugSession {
  _id?: string
  shortId?: string
  name?: string
  attributes?: {
    userName?: string,
    userId?: string,
    accountName?: string,
    accountId?: string,
  } & object
  tags?: {
    key?: string
    value: string
  }[]
  feedbackMetadata?: {
    email?: string
    notifyOnUpdates?: boolean
    comment?: string
  },
  resourceAttributes?: object
}
