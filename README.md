# SceneBuddy AI

An AI-powered scene partner for actors. Upload any script, choose your character, and rehearse with responsive AI voices.

## Features

- **📄 Direct PDF Parsing** - No external dependencies, scripts parse instantly
- **🎭 Character Selection** - Choose who you want to play
- **🔊 AI Voice Partners** - Natural real-time conversation using OpenAI Realtime API
- **📜 Live Teleprompter** - See your script with current line highlighted
- **🎬 Automatic Turn Detection** - AI knows when you're done speaking (1.5s silence)
- **⏯️ Dramatic Pause Mode** - Tap "Keep Pausing" for intentional silence
- **📱 Mobile-First** - Hands-free rehearsal, no buttons needed

## Tech Stack

- Next.js 14 + TypeScript
- Tailwind CSS
- Clerk Authentication
- Vercel Postgres
- OpenAI Realtime API (WebRTC)
- Direct PDF parsing (no N8N!)

## How It Works

1. **Upload Script** - PDF parses instantly, characters auto-detected
2. **Choose Character** - Select who you play, AI voices the rest
3. **Rehearse Hands-Free** - 
   - Speak naturally, AI responds automatically
   - 1.5 seconds of silence = "you're done, AI speaks"
   - Tap "Keep Pausing" button for dramatic effect
   - Full teleprompter with live highlighting

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in your API keys:
   - Clerk (authentication)
   - Vercel Postgres (database)
   - OpenAI (Realtime voice API)
   - ElevenLabs (optional alternative voices)
4. Set up database: `npm run db:setup`
5. Run dev server: `npm run dev`

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
POSTGRES_URL=
OPENAI_API_KEY=
ELEVENLABS_API_KEY= (optional)
```

## Usage

1. **Upload Script** - Upload any PDF screenplay
2. **Setup** - Choose your character and assign voices to AI partners
3. **Rehearse** - 
   - Use any device (phone, tablet, computer)
   - No buttons needed - just speak naturally
   - AI responds after 1.5s of silence
   - Tap "Keep Pausing" for dramatic moments
   - See script on screen with live highlighting

## The Experience

**Automatic Mode (Default):**
- You speak your line
- Pause naturally (up to 1.5 seconds between thoughts)
- AI automatically responds when you stop
- Visual countdown shows when AI will speak

**Dramatic Pause Mode:**
- When you pause longer than 5 seconds, "Keep Pausing" button appears
- Tap it to hold the moment
- AI waits until you're ready

**Manual Override:**
- "Next Line" button always available
- "Pause" to freeze the session
- "Go Back" to retry a line

## License

MIT
