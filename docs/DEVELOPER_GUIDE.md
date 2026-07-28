# PAPPYBOT V2 — Developer Guide

## Project Setup

```bash
git clone https://github.com/pappy999666-dotcom/ANTISYSTEM-.git
cd ANTISYSTEM-
npm ci
cp .env.example .env
npm run dev
```

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Hot-reload dev server (ts-node-dev) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled build |
| `npm test` | Run all tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run typecheck` | `tsc --noEmit` (zero-error check) |
| `npm run lint` | ESLint |

---

## Adding a Command

1. Create `src/commands/builtin/MyCommand.ts`:

```typescript
import { BaseCommand } from '../BaseCommand';
import type { CommandContext } from '../../types/Command';
import { R } from '../../ui/ResponseFormatter';

export class MyCommand extends BaseCommand {
  readonly meta = {
    name: 'mycommand',
    aliases: ['mc'],
    description: 'Does something cool',
    category: 'utility',
    cooldown: 3000,
  };

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.reply(R.success('MyCommand', 'It works!'));
  }
}
```

2. Register in `src/core/App.ts`:

```typescript
commandEngine.register(new MyCommand());
```

---

## Adding a Plugin

```typescript
// src/plugins/MyPlugin.ts
import { BasePlugin, type PluginContext } from './BasePlugin';

export class MyPlugin extends BasePlugin {
  readonly meta = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'Does cool stuff',
  };

  async load(ctx: PluginContext): Promise<void> {
    ctx.commands.register(new MyCommand());
    ctx.listeners.register(new MyListener());
    ctx.scheduler.schedule({
      name: 'my-job',
      cronExpression: '0 * * * *',
      fn: async () => { /* ... */ },
      enabled: true,
    });
  }
}
```

Register in `App.ts`:

```typescript
await pluginManager.load(new MyPlugin());
```

---

## Adding a Listener

```typescript
import { BaseListener } from '../../listeners/BaseListener';
import type { EventBus } from '../../events/EventBus';

export class MyListener extends BaseListener {
  readonly id = 'my-listener';

  register(bus: EventBus): void {
    this.addSubscription(
      bus.on('message:received', async ({ message }) => {
        // handle message
      })
    );
  }
}
```

---

## Adding a Repository

```typescript
import { BaseRepository } from '../../database/BaseRepository';

interface MyRecord { id: string; value: string; }

export class MyRepository extends BaseRepository<MyRecord> {
  protected readonly tableName = 'my_table';

  async init(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  async findById(id: string): Promise<MyRecord | undefined> {
    const rows = await this.query<MyRecord>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`, [id]
    );
    return rows[0];
  }
}
```

---

## ResponseFormatter

All command replies must use `R.*` builders from `src/ui/ResponseFormatter.ts`:

```typescript
import { R } from '../../ui/ResponseFormatter';

// In a command:
await ctx.reply(R.success('Title', 'Body text'));
await ctx.reply(R.error('Title', 'Something went wrong'));
await ctx.reply(R.warning('Title', 'Be careful'));
await ctx.reply(R.info('Title', 'Some info'));
```

---

## TargetResolver

Resolve mentions, quoted messages, or phone numbers to JIDs:

```typescript
import { TargetResolver } from '../../utils/TargetResolver';

const target = TargetResolver.resolveTarget(ctx.message, ctx.args.argv[0]);
if (!target) {
  await ctx.reply(R.error('Error', 'No target specified'));
  return;
}
// target is a JID string
```

---

## Testing

Tests live in `tests/`. Run with `npm test`.

- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`

Mock the logger in `tests/setup.ts` — it's already configured.

```typescript
// Example test
import { CacheManager } from '../../../src/cache/CacheManager';

describe('MyFeature', () => {
  it('does something', () => {
    const cache = new CacheManager();
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    cache.shutdown();
  });
});
```

---

## TypeScript Path Aliases

Use `@` aliases instead of relative paths:

```typescript
import { logger } from '@logger/Logger';
import { eventBus } from '@events/EventBus';
import { config } from '@config/ConfigManager';
import { container } from '@core/Container';
```

Full alias map is in `tsconfig.json` and `jest.config.ts`.

---

## Coding Standards

- Business logic lives in **services** — commands are thin controllers
- Never call Baileys socket methods directly from business logic — use `ResponseEngine` or `SocketManager`
- Every module gets a child logger: `const log = logger.child('ModuleName')`
- All external input passes through `sanitizeInput()` before use
- Run `npm run typecheck` before every commit — zero errors required
