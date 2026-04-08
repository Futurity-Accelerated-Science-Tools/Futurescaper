# Futurescape Web - Public Web Version

A web-hosted version of Futurescape where YOU provide the AI API key so users don't need their own.

## How It Works

```
[Browser] --> [Your Backend Server] --> [DeepSeek API]
                    |
            Your API key stored
            securely on server
```

Users get free access, you pay for API usage (very cheap with DeepSeek: ~$0.14/million tokens).

## Quick Start

### 1. Get a DeepSeek API Key

1. Go to https://platform.deepseek.com/api_keys
2. Sign up and add ~$5 credit (lasts a very long time!)
3. Create an API key

### 2. Setup

```bash
# Clone/copy this folder
cd Futurescape-Web

# Install dependencies
npm install

# Create .env file with your API key
cp .env.example .env
# Edit .env and add your DEEPSEEK_API_KEY
```

### 3. Run Locally

```bash
npm run dev
```

This starts both:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### 4. Deploy to Production

#### Option A: Railway (Easiest)

1. Push to GitHub
2. Go to https://railway.app
3. Create new project → Deploy from GitHub
4. Add environment variable: `DEEPSEEK_API_KEY`
5. Done! Get your URL

#### Option B: Render

1. Push to GitHub
2. Go to https://render.com
3. Create Web Service
4. Set build command: `npm install && npm run build && npm run build:server`
5. Set start command: `npm start`
6. Add environment variable: `DEEPSEEK_API_KEY`

#### Option C: VPS/Server

```bash
# Build
npm run build
npm run build:server

# Run (with PM2 recommended)
pm2 start dist-server/index.js --name futurescape

# Or with systemd service
```

## Cost Estimation

DeepSeek costs ~$0.14 per million tokens.

- Average session: ~20,000 tokens = ~$0.003 (less than 1 cent)
- 1000 users/month: ~$3/month
- 10,000 users/month: ~$30/month

Very affordable!

## Rate Limiting

Built-in rate limiting: 10 requests per minute per IP.
Adjust in `server/index.ts` if needed.

## Security Notes

- API key is stored only on server, never exposed to clients
- Rate limiting prevents abuse
- Consider adding CAPTCHA for production
- Monitor usage via `/api/stats` endpoint

## Files Structure

```
Futurescape-Web/
├── server/
│   └── index.ts        # Express backend with DeepSeek proxy
├── src/
│   ├── api/
│   │   ├── backend.ts  # Calls your backend (not DeepSeek directly)
│   │   ├── claude.ts   # Generation logic
│   │   └── prompts.ts  # STEEP methodology prompts
│   ├── components/     # React components
│   ├── App.tsx         # Main app (no API key input needed)
│   └── types.ts        # TypeScript types
├── .env.example        # Environment template
└── package.json        # Dependencies
```

## Customization

### Change AI Provider

Edit `server/index.ts` to use a different provider. The code is written for OpenAI-compatible APIs, so it works with:
- DeepSeek (default)
- Groq
- OpenRouter
- Any OpenAI-compatible API

### Add Authentication

For production, consider adding:
- User accounts
- Usage quotas per user
- Payment integration (Stripe)

## Support

This is the public web version of Futurescape using the "Synthesizing Futures" methodology.
