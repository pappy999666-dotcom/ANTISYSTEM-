# PAPPYBOT V2

Production-grade WhatsApp automation platform.

## Stack
- **Runtime**: Node.js 20 + TypeScript
- **WhatsApp**: @crysnovax/baileys
- **Logging**: pino
- **Database**: SQLite (default) / MongoDB / PostgreSQL
- **Scheduler**: node-cron
- **Testing**: Jest + ts-jest

## Run
```bash
npm run dev      # development (ts-node-dev)
npm run build    # compile to dist/
npm start        # run compiled output
npm test         # run tests
```

## User Preferences
- Use `@crysnovax/baileys` exclusively — no other Baileys forks
- Never invent unsupported Baileys APIs
- Business logic lives in services, not commands
- All modules must be isolated (one crash never affects others)
- Architecture prompt file: `attached_assets/Pasted-PAPPYBOT-V2-MASTER-ARCHITECTURE-FOUNDATION-PROMPT-1-You_1785201183753.txt`
