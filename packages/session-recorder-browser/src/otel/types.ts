interface BrowserSDKInstrumentations {
  document?: boolean;
  fetch?: boolean;
  xhr?: boolean;
  interactions?: boolean;
}

export interface BrowserSdkConfig {
  version: string;
  application: string;
  environment: string;
  ignoreUrls?: Array<string | RegExp>;
}

export interface BrowserSDKType {
  init: (options: BrowserSdkConfig) => void;
}
