# Overview

This module is for creating release and deployment. It can be used from the command line or programatically from a node script.

## Command Line

### Install

In order to create release or deployment from the command line, install the library globally.

```
npm install -g @multiplayer-app/cli
```

### Usage

Options can be provided on the command line or as environment variables.

##### Create release:

```
multiplayer-app-cli releases create --apiKey=[apiKey] --service=[name] --release=[release] --releaseNotes=[releaseNotes]

Options:
  --apiKey         Multiplayer personal user API key (MULTIPLAYER_API_KEY)
  --service        Service name (SERVICE_NAME)
  --release        Service release (RELEASE)
  --commitHash     [Optional] Repository URL (REPOSITORY_URL)
  --releaseNotes   [Optional] Release notes (RELEASE_NOTES)
```

##### To create deployment:

```
multiplayer-app-cli deployments create --apiKey=[apiKey] --service=[name] --release=[release] --environment=[environment]

Options:
  --apiKey         Multiplayer personal user API key (MULTIPLAYER_API_KEY)
  --service        Service name (SERVICE_NAME)
  --release        Service release (RELEASE)
  --environment    [Optional] Environment name (ENVIRONMENT)
```

### Upload sourcemap

```
multiplayer-app-cli sourcemap upload /path/to/directory --apiKey=[apiKey] --service=[name] --release=[release] --environment=[environment]

Options:
  --apiKey         Multiplayer personal user API key (MULTIPLAYER_API_KEY)
  --service        Service name (SERVICE_NAME)
  --release        Service release (RELEASE)
  --environment    [Optional] Environment name (ENVIRONMENT)
```
