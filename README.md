# SceneBuddy AI

An AI-powered scene partner for actors. Upload any script, choose your character, and rehearse with responsive AI voices at your own pace.

## Features

- **📄 Direct PDF Parsing** - No external dependencies, scripts parse instantly
- **🎭 Character Selection** - Choose who you want to play
- **🔊 AI Voice Partners** - Natural voices using ElevenLabs API
- **📜 Live Teleprompter** - See your script with current line highlighted
- **⏯️ Manual Turn Control** - Press spacebar to advance, never feel rushed
- **🎬 Dramatic Pauses** - Take your time, control the pacing

## Tech Stack

- Next.js 14 + TypeScript
- Tailwind CSS
- Clerk Authentication
- Vercel Postgres
- ElevenLabs API for voices
- Direct PDF parsing (no N8N!)

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in your API keys:
   - Clerk (authentication)
   - Vercel Postgres (database)
   - ElevenLabs (voices)
4. Set up database: `npm run db:setup`
5. Run dev server: `npm run dev`

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
POSTGRES_URL=
ELEVENLABS_API_KEY=
```

## Usage

1. **Upload Script** - Upload any PDF screenplay
2. **Setup** - Choose your character and assign voices to AI partners
3. **Rehearse** - Use spacebar to advance lines, see script on screen, hear AI voices

## Keyboard Shortcuts

- `Space` - Advance to next line
- `←` / `→` - Navigate lines
- `P` - Pause/Resume

## License

MIT
