---
title: Yettify
emoji: 🎵
colorFrom: green
colorTo: indigo
sdk: static
app_build_command: npm run build
app_file: dist/index.html
pinned: false
---

# Yettify

A full-stack Spotify reconstruction built with Next.js 14, Tailwind CSS, Prisma, and LibSQL / Turso.

## Features

- Complete music player with playlist, album, artist, and search support
- Streaming audio integration and playback controls
- User preferences, play history, and personalized recommendations
- Turso / LibSQL integration for distributed serverless data storage

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (`.env`):
   ```env
   DATABASE_URL="file:./dev.db"
   TURSO_DATABASE_URL="libsql://your-database.turso.io"
   TURSO_AUTH_TOKEN="your-turso-auth-token-here"
   NODE_ENV="development"
   ```

3. Generate Prisma client & initialize database:
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
