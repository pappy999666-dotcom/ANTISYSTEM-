# PAPPYBOT V2 — Troubleshooting & FAQ

## QR Code Issues

**QR not appearing in terminal**

The QR is printed via `qrcode-terminal`. If running in Docker or a headless environment, check logs:

```bash
docker compose logs pappybot | grep -A 30 "QR code"
```

Alternatively, use the pairing code flow via the web API:

```
POST /api/sessions/:id/pair
Body: { "phone": "628123456789" }
```

**QR expires before scanning**

WhatsApp QR codes expire after ~60 seconds. The bot will generate a new one automatically. Check logs for `QR code generated`.

---

## Connection Issues

**Session keeps reconnecting**

Check `LOG_LEVEL=debug` output for the disconnect reason. Common causes:

- `loggedOut` (status 401) — WhatsApp logged out the session. Delete and re-pair.
- `connectionReplaced` — Another device connected with the same number.
- `restartRequired` — Transient; the bot reconnects automatically.

**Max reconnect attempts reached**

The bot gives up after 10 attempts (configurable via `SESSION_MAX_RECONNECT_ATTEMPTS` constant). Restart the process or use the web API to restart the session.

---

## Database Issues

**SQLite: SQLITE_BUSY**

Only one process should write to the SQLite file at a time. Ensure you're not running multiple bot instances pointing to the same file.

**MongoDB: connection refused**

Verify `DB_MONGO_URI` is correct and the MongoDB instance is reachable from the bot's network.

**PostgreSQL: authentication failed**

Check `DB_PG_USER`, `DB_PG_PASSWORD`, and that the user has `CREATE TABLE` privileges on `DB_PG_DATABASE`.

---

## Web Dashboard Issues

**401 Unauthorized on login**

- Ensure `WEB_SECRET` in `.env` matches what you're entering in the login form.
- Ensure you've registered via the Telegram bot first (`/start` in Telegram).

**WebSocket not connecting**

- Check that `WEB_ORIGIN` in `.env` matches your frontend URL.
- If behind nginx, ensure the WebSocket proxy config is in place (see `nginx.conf`).

---

## AI Assistant Issues

**AI not responding**

1. Check `.aiinfo` — verify provider, model, and token are set.
2. Check `.ai on` is enabled for the session.
3. Verify the API key is valid for the selected provider.
4. Check logs for `AIProviderService` errors.

**"Provider not configured" error**

Run in a private chat with the bot:
```
.setaiprovider openai
.setaitoken sk-...
.setaimodel gpt-4o-mini
.ai on
```

---

## Anti System Issues

**AntiLink not blocking links**

1. Verify antilink is enabled for the group: check `AntiConfigManager` settings.
2. Ensure the bot is a group admin (required to delete messages).
3. Check that `adminBypass` is not set to `true` for the sender.

**Bot kicking admins**

By default, `adminBypass: true` prevents actions against group admins. If this is happening, check the group config.

---

## Performance Issues

**High memory usage**

- Check `GET /health` for RSS and heap usage.
- Reduce `cache.ttl` in `config/config.json` to evict entries faster.
- Reduce `monitor.snapshotIntervalMs` to emit snapshots less frequently.

**Slow command responses**

- Check `!ping` output for API round-trip latency.
- If database queries are slow, add indexes to frequently queried columns.

---

## FAQ

**Can I run multiple WhatsApp numbers?**

Yes. Create multiple sessions via the web API or Telegram panel. Each session is fully isolated.

**Does the bot work with WhatsApp Business?**

Yes, Baileys supports both personal and Business accounts.

**Can I use a custom command prefix?**

Yes. Set `CMD_PREFIX=.` in `.env` (or any single character).

**How do I update the bot?**

```bash
git pull origin main
npm ci
npm run build
# Restart the process
```

**Where are session credentials stored?**

In `storage/sessions/<sessionId>/` as JSON files managed by Baileys' auth state.

**How do I reset a session?**

Delete the session via the web API (`DELETE /api/sessions/:id`) or Telegram panel. This removes all auth files and the session record.

**Is the AI conversation memory persistent?**

Yes. Memory is stored in the database (`ai_memory` table) and survives restarts.

**How do I disable the web dashboard?**

Set `WEB_ENABLED=false` in `.env`.

**How do I disable the Telegram panel?**

Leave `TELEGRAM_BOT_TOKEN` unset in `.env`.
