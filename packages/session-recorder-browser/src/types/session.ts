import { SessionType } from '@multiplayer-app/session-recorder-common'

export interface IResourceAttributes {
  browserInfo?: string,
  cookiesEnabled?: string,
  deviceInfo?: string,
  hardwareConcurrency?: number,
  osInfo?: string,
  pixelRatio?: number,
  screenSize?: string,
  packageVersion?: string,
  [key: string]: any
}

export interface ISessionAttributes {
  userEmail?: string
  userId?: string,
  userName?: string,
  accountId?: string,
  accountName?: string,
  [key: string]: any
}

export interface ISessionView {
  _id: string
  name: string
  components?: string[]
}

export interface ISession {
  _id: string
  shortId: string
  workspace: string
  project: string
  continuousDebugSession?: string
  creationType: SessionType
  name: string
  startedAt: string | Date
  stoppedAt: string | Date
  durationInSeconds?: number
  createdAt: string | Date
  updatedAt: string | Date
  tags: any[]

  resourceAttributes?: IResourceAttributes
  sessionAttributes?: ISessionAttributes
  views: ISessionView[]
  starred: boolean
  starredItems: string[]
  s3Files: {
    _id?: string
    bucket: string
    key: string
    dataType: DebugSessionDataType
    url?: string
  }[]
  finishedS3Transfer?: boolean
  tempApiKey?: string
}

export enum DebugSessionDataType {
  OTLP_TRACES = 'OTLP_TRACES',
  OTLP_LOGS = 'OTLP_LOGS',
  RRWEB_EVENTS = 'RRWEB_EVENTS',
}
