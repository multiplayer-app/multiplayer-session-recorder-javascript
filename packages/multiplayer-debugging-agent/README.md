# @multiplayer-app/debugging-agent

Multiplayer CLI — AI-powered debugging agent and release management tool.

## Install

```
npm install -g @multiplayer-app/debugging-agent
```

## Usage

```
multiplayer [command] [options]
```

If no command is provided, the debugging agent starts in TUI mode.

---

## Debugging Agent

Automatically resolves issues using AI. Connects to the Multiplayer backend and processes incoming issues in real time.

```
multiplayer [options]
```

Options can be provided as flags, environment variables, or a `.multiplayer/config` profile file.

| Flag | Env var | Description |
|------|---------|-------------|
| `--api-key <key>` | `MULTIPLAYER_API_KEY` | Multiplayer API key |
| `--dir <path>` | `MULTIPLAYER_DIR` | Project directory (must be a git repo) |
| `--model <name>` | `AI_MODEL` | AI model (e.g. `claude-sonnet-4-6`, `gpt-4o`) |
| `--model-key <key>` | `AI_API_KEY` | API key for the AI provider (not needed for Claude) |
| `--model-url <url>` | `AI_BASE_URL` | Optional base URL for OpenAI-compatible APIs |
| `--headless` | `MULTIPLAYER_HEADLESS=true` | Run without TUI, outputs structured JSON logs |
| `--profile <name>` | `MULTIPLAYER_PROFILE` | Config profile to use (default: `default`) |
| `--name <name>` | `MULTIPLAYER_AGENT_NAME` | Agent name (defaults to hostname) |
| `--max-concurrent <n>` | `MULTIPLAYER_MAX_CONCURRENT` | Max parallel issues (default: `2`) |
| `--no-git-branch` | `MULTIPLAYER_NO_GIT_BRANCH=true` | Work in current branch — no worktree, no push |
| `--health-port <port>` | `MULTIPLAYER_HEALTH_PORT` | HTTP health check port (headless only) |
| `--url <url>` | `MULTIPLAYER_URL` | Multiplayer API base URL |

### TUI mode (default)

```
multiplayer --api-key <key> --dir /path/to/repo --model claude-sonnet-4-6
```

### Headless mode

```
multiplayer --headless --api-key <key> --dir /path/to/repo --model claude-sonnet-4-6
```

### Config profiles

Create a `.multiplayer/config` file in your project or home directory:

```ini
[default]
api_key = <your-api-key>
dir = /path/to/repo
model = claude-sonnet-4-6
max_concurrent = 2
```

---

## Releases

```
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

```
multiplayer releases create \
  --api-key $MULTIPLAYER_API_KEY \
  --service my-service \
  --release-version 1.2.3 \
  --commit-hash abc123 \
  --repository-url https://github.com/org/repo
```

---

## Deployments

```
multiplayer deployments create [options]
```

| Flag | Env var | Description |
|------|---------|-------------|
| `--api-key <key>` | `MULTIPLAYER_API_KEY` | Multiplayer API key |
| `--service <name>` | `SERVICE_NAME` | Service name |
| `--release <version>` | `RELEASE` | Release version |
| `--environment <name>` | `ENVIRONMENT` | Environment name |
| `--base-url <url>` | `BASE_URL` | API base URL (optional) |

**Example:**

```
multiplayer deployments create \
  --api-key $MULTIPLAYER_API_KEY \
  --service my-service \
  --release 1.2.3 \
  --environment production
```

---

## Sourcemaps

```
multiplayer sourcemaps upload <directories...> [options]
```

| Flag | Env var | Description |
|------|---------|-------------|
| `--api-key <key>` | `MULTIPLAYER_API_KEY` | Multiplayer API key |
| `--service <name>` | `SERVICE_NAME` | Service name |
| `--release <version>` | `RELEASE` | Release version |
| `--base-url <url>` | `BASE_URL` | API base URL (optional) |

**Example:**

```
multiplayer sourcemaps upload ./dist ./build \
  --api-key $MULTIPLAYER_API_KEY \
  --service my-service \
  --release 1.2.3
```
