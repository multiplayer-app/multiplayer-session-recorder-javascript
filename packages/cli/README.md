# @multiplayer-app/cli

AI-powered debugging agent and release management CLI for [Multiplayer](https://multiplayer.app).

## Install

```sh
npm install -g @multiplayer-app/cli
```

Supports macOS (arm64, x64), Linux (arm64, x64), and Windows (arm64, x64). The correct platform binary is installed automatically.

## Commands

| Command | Description |
|---------|-------------|
| `multiplayer` | Start the debugging agent (TUI by default) |
| `multiplayer releases create` | Register a release |
| `multiplayer deployments create` | Register a deployment |
| `multiplayer sourcemaps upload` | Upload sourcemap files |

---

## Debugging Agent

Connects to the Multiplayer backend and automatically resolves incoming issues using AI.

```sh
multiplayer [options]
```

Options are resolved in this order: **CLI flag → environment variable → config profile**.

| Flag | Env var | Description |
|------|---------|-------------|
| `--api-key <key>` | `MULTIPLAYER_API_KEY` | Multiplayer API key |
| `--dir <path>` | `MULTIPLAYER_DIR` | Project directory (must be a git repo) |
| `--model <name>` | `AI_MODEL` | AI model (e.g. `claude-sonnet-4-6`, `gpt-4o`) |
| `--model-key <key>` | `AI_API_KEY` | AI provider API key (not required for Claude models) |
| `--model-url <url>` | `AI_BASE_URL` | Base URL for OpenAI-compatible APIs |
| `--headless` | `MULTIPLAYER_HEADLESS=true` | Run without TUI — outputs structured JSON logs |
| `--profile <name>` | `MULTIPLAYER_PROFILE` | Config profile to load (default: `default`) |
| `--name <name>` | `MULTIPLAYER_AGENT_NAME` | Agent name (defaults to hostname) |
| `--max-concurrent <n>` | `MULTIPLAYER_MAX_CONCURRENT` | Max issues resolved in parallel (default: `2`) |
| `--no-git-branch` | `MULTIPLAYER_NO_GIT_BRANCH=true` | Work in current branch — no worktree, no push |
| `--health-port <port>` | `MULTIPLAYER_HEALTH_PORT` | HTTP health check port (headless mode only) |
| `--url <url>` | `MULTIPLAYER_URL` | Multiplayer API base URL |

### TUI mode (default)

An interactive terminal dashboard that shows active sessions and live logs.

```sh
multiplayer --api-key <key> --dir /path/to/repo --model claude-sonnet-4-6
```

### Headless mode

Outputs newline-delimited JSON logs — suitable for CI, containers, and log aggregators.

```sh
multiplayer --headless --api-key <key> --dir /path/to/repo --model claude-sonnet-4-6
```

In headless mode, `SIGTERM` waits for active sessions to finish before exiting; `SIGINT` exits immediately.

### Config profiles

Create a `.multiplayer/config` file in your project directory or home directory (`~/.multiplayer/config`). Uses INI format — the same as AWS credentials.

```ini
[default]
api_key    = <your-api-key>
dir        = /path/to/repo
model      = claude-sonnet-4-6
max_concurrent = 2

[staging]
api_key    = <staging-api-key>
dir        = /path/to/staging-repo
model      = gpt-4o
model_key  = <openai-api-key>
```

All supported profile keys:

| Key | Description |
|-----|-------------|
| `api_key` | Multiplayer API key |
| `dir` | Project directory |
| `model` | AI model name |
| `model_key` | AI provider API key |
| `model_url` | Base URL for OpenAI-compatible APIs |
| `name` | Agent name |
| `url` | Multiplayer API base URL |
| `max_concurrent` | Max parallel issues |
| `no_git_branch` | `true` to skip branch/worktree creation |

---

## Releases

```sh
multiplayer releases create [options]
```

| Flag | Env var | Description |
|------|---------|-------------|
| `--api-key <key>` | `MULTIPLAYER_API_KEY` | Multiplayer API key |
| `--service <name>` | `SERVICE_NAME` | Service name |
| `--release-version <version>` | `RELEASE` | Release version |
| `--commit-hash <hash>` | `COMMIT_HASH` | Commit hash |
| `--repository-url <url>` | `REPOSITORY_URL` | Repository URL |
| `--release-notes <notes>` | `RELEASE_NOTES` | Release notes (optional) |
| `--base-url <url>` | `BASE_URL` | API base URL (optional) |

**Example:**

```sh
multiplayer releases create \
  --api-key $MULTIPLAYER_API_KEY \
  --service my-service \
  --release-version 1.2.3 \
  --commit-hash abc123 \
  --repository-url https://github.com/org/repo
```

---

## Deployments

```sh
multiplayer deployments create [options]
```

| Flag | Env var | Description |
|------|---------|-------------|
| `--api-key <key>` | `MULTIPLAYER_API_KEY` | Multiplayer API key |
| `--service <name>` | `SERVICE_NAME` | Service name |
| `--release <version>` | `VERSION` | Release version |
| `--environment <name>` | `ENVIRONMENT` | Environment name |
| `--base-url <url>` | `BASE_URL` | API base URL (optional) |

**Example:**

```sh
multiplayer deployments create \
  --api-key $MULTIPLAYER_API_KEY \
  --service my-service \
  --release 1.2.3 \
  --environment production
```

---

## Sourcemaps

```sh
multiplayer sourcemaps upload <directories...> [options]
```

| Flag | Env var | Description |
|------|---------|-------------|
| `--api-key <key>` | `MULTIPLAYER_API_KEY` | Multiplayer API key |
| `--service <name>` | `SERVICE_NAME` | Service name |
| `--release <version>` | `RELEASE` | Release version |
| `--base-url <url>` | `BASE_URL` | API base URL (optional) |

**Example:**

```sh
multiplayer sourcemaps upload ./dist ./build \
  --api-key $MULTIPLAYER_API_KEY \
  --service my-service \
  --release 1.2.3
```
