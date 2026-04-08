# Futurescape Docker Deployment

## Quick Start (with API Key)

### Step 1: Get a DeepSeek API Key
1. Go to https://platform.deepseek.com/api_keys
2. Sign up and add $5 credit (lasts months!)
3. Create an API key (starts with `sk-`)

### Step 2: Build & Run

**Option A: Using .env file (recommended)**
```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your API key
# VITE_DEEPSEEK_API_KEY=sk-your-actual-key-here

# Build and run
docker-compose up -d --build
```

**Option B: One-line command**
```bash
VITE_DEEPSEEK_API_KEY=sk-your-key-here docker-compose up -d --build
```

### Step 3: Access the App
Open http://localhost:3000 in your browser

The app will automatically use the pre-configured API key - no setup needed for testers!

---

## Alternative: Without Pre-configured Key

If you don't set an API key during build, users will be prompted to enter their own key when they use the app.

```bash
docker-compose up -d --build
```

---

## Commands

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild after code changes
docker-compose up -d --build --force-recreate
```

## Configuration

### Change Port
Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Change 3000 to any port
```

### Using Different AI Providers

You can use any of these providers by setting the corresponding env variable:

| Provider | Env Variable | Cost |
|----------|-------------|------|
| DeepSeek | `VITE_DEEPSEEK_API_KEY` | ~$0.14/1M tokens |
| Groq | `VITE_GROQ_API_KEY` | Free tier available |
| OpenAI | `VITE_OPENAI_API_KEY` | ~$2.50/1M tokens |
| Google Gemini | `VITE_GEMINI_API_KEY` | ~$0.075/1M tokens |
| Claude | `VITE_CLAUDE_API_KEY` | ~$3.00/1M tokens |
| OpenRouter | `VITE_OPENROUTER_API_KEY` | Varies |

Example with multiple keys:
```bash
VITE_DEEPSEEK_API_KEY=sk-xxx VITE_GROQ_API_KEY=gsk-xxx docker-compose up -d --build
```

---

## Security Note

⚠️ **For production/public deployments**: The API key is embedded in the JavaScript bundle. This is fine for:
- Internal testing
- Demos with trusted users
- Evaluation purposes

For public deployments with untrusted users, consider:
- Having users enter their own keys (don't set env var)
- Implementing a backend proxy for API calls
- Rate limiting at the infrastructure level
