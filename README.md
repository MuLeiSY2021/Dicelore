<p align="right"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>

<p align="center">
  <img src="docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/dicelore-logo-dark.png" alt="Dicelore" width="440">
</p>

<p align="center"><strong><em>A rose without thorns is too perfect to be true.</em></strong></p>

<p align="center">An agentic text-adventure game platform — turning AI into a game master that respects the dice and doesn't pander to players.</p>

---

## What is Dicelore?

**Dicelore** is a multi-agent, multi-model front-and-back-end interface (in active development), paired with a TTRPG-specialized agent suite. This agent suite shapes the AI into a game master that truly respects the dice and refuses to pander: authoritative game state is locked away somewhere the AI cannot touch, dice genuinely decide outcomes, and text-adventure games recover their real tension and consequences.

It serves two kinds of people — **players** who want to play text-adventure games, and **authors** who want to write them.

---

## Why Dicelore Exists

A friend of mine once sighed, 「虚拟太完美了，像一朵没有味道也没有刺的玫瑰。」 — *the virtual is too perfect, like a rose with neither scent nor thorns.*

That remark names a real problem: play text-adventure games with AI long enough and you grow bored — because the AI is too eager to please. The failure shows up in three forms:

- **F1 — Dice-skip**: When the dice should decide the outcome, the AI just writes a result that favors the player.
- **F2 — Soft landing**: A bad roll comes up, and the AI quietly walks it back.
- **F3 — Taking the wheel**: When the player should be making a choice, the AI makes it for them.

Once players learn that nothing they do can truly backfire, the sense of risk disappears and the game degrades into pure wish fulfillment.

This is not a flaw in any particular product — it is the fundamental limitation of the **prompt-based paradigm**: game state lives inside the AI's own generated text, which it can rewrite at any moment; no amount of world-building or rule-loading can stop it from pulling its punches when it matters most.

Dicelore's answer is an **agentic architecture** — locking the AI inside a world it cannot falsify. Authoritative game state is externalised into a SQLite database the AI cannot reach, organized across four state domains: `sheet` (character sheets / inventory), `event` (story events), `world` (world settings / draw pools), and `rule` (versioned, read-only rules). Dice rolls and randomization are executed by the engine; the AI can only reference the results. Three constraint layers close off the failure modes:

- **L1 — Tool enforcement**: Rolling dice, drawing random results, and mutating state all go through tools. The AI has no way around them.
- **L2 — Shaping doctrine**: A skill suite (Agenda → Principles → Moves) teaches the AI how to be a good game master.
- **L3 — Audit**: Post-hoc detection of violations.

| | Prompt-based paradigm | Dicelore (agentic) |
|---|---|---|
| Where state lives | Inside the AI's output | SQLite, out of the AI's reach |
| Who rolls / draws | The AI writes a number | The engine executes; AI gets a reference |
| Cost of adding a capability | Fatter context, rising token count | One more tool; context unchanged |
| Preventing dice-skips / soft landings | Relies on AI goodwill | Structurally, the AI never sees ground truth |

---

## Our Vision

Dicelore is dedicated to serving players who want to play text-adventure games and authors who want to craft them — providing both with a beautiful, elegant, and modern interface while maximizing compatibility with customization and community ecosystems. Multi-platform bundles are a v1 release priority, with **Android and Windows first** (macOS, Linux, and iOS to follow).

---

## How to Play

> Currently playable: **solo text-adventure game** (anka form: forum-style, dice- and vote-driven collaborative play).

There are two player entry points planned for v1 — pick whichever fits you:

- **Multi-platform bundle** (Android / Windows first; macOS, Linux, and iOS to follow): a single download containing the client UI plus a local backend sidecar. Just fill in your **API key + base URL** and play — no command line, no separate server to run. *(In development — see [Milestones](docs/wiki/设计/05-现状与计划/里程碑.md) for progress.)*
- **Self-hosted backend + browser**: run the `backend` yourself via docker-compose (good for remote / multi-tenant hosting), then play through the web client in your browser. Fill in your **API key + base URL** the same way. *(Step-by-step in the [Player Guide](docs/wiki/指南/玩家指南.md).)*

The framework enforces dice rolls and option-giving, maintains character sheets and story state, and the AI narrates from the result — no soft landings.

> **New here?** Start with the **[Guides](docs/wiki/指南/)** — task-oriented walkthroughs for the three kinds of people who use Dicelore:
> [**Player Guide**](docs/wiki/指南/玩家指南.md) (install · run · play a session) · [**Author Guide**](docs/wiki/指南/作者指南.md) (build an Adventure · DIY a custom MCP) · [**Developer Guide**](docs/wiki/指南/开发者指南.md) (DIY plugins · interface specs · dev examples).

> **Note on the CLI:** the `dicelore` CLI is a **developer / session-management tool** (`new` / `list` / `inspect` / `init`), **not** a player entry point — it has no `play` command. If you want to try Dicelore today without waiting for the bundle, see [Installation](#installation-in-progress) below for the developer path (run the backend + web locally).

---

## Questions or Suggestions?

The [`docs/wiki/`](docs/wiki/) is split into two domains: **[Guides](docs/wiki/指南/)** (task-oriented, for players / authors / developers) and **[Design](docs/wiki/设计/)** (the for-maintainers derivation chain: business → domain model → architecture → subsystem design → status). Design rationale lives inline in each design page's *Decisions & Trade-offs* section (with a thin [change log](docs/wiki/设计/决策变更日志.md); historical records are archived). The single source for terminology is the top-level [glossary](docs/wiki/术语表.md).

Questions, suggestions, or want to contribute? Open an [issue](../../issues), or read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and conventions.

---

## Screenshots

> The complete standalone web player client (Component 7): a VSCode-style draggable-component workspace with the **"Ink & Gold" theme** (deep ink-green + gold trim, skinnable, light/dark modes, optional accent color). Below are the finalized design sketches (implementation in progress).

![Play page](docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/play.png)

<p align="center"><sub>Play page · left activity rail · center narrative/typing combined · d10 dice roll · right "Stage" panel (grid-docked panels) · circular PbtA countdown clock</sub></p>

![Home page](docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/home.png)

<p align="center"><sub>Home page · welcome screen · <a href="docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/home.html">runnable sketch</a></sub></p>

![Adventure builder](docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/build.png)

<p align="center"><sub>Adventure builder · build workbench · <a href="docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/build.html">runnable sketch</a></sub></p>

![Settings](docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/config.png)

<p align="center"><sub>Settings · MCP / model / theme · <a href="docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/config.html">runnable sketch</a></sub></p>

<p align="center"><sub>Design language and four-page IA → <a href="docs/wiki/设计/04-子系统设计/玩家客户端-视觉.md">Player client — visuals</a></sub></p>

---

## Installation (In Progress)

> The multi-platform player bundle is still in development. The steps below are the **developer path**: clone the repo, install dependencies, and run the stack locally. (This is for development, not the player entry point — players use the bundle or self-hosted backend described in [How to Play](#how-to-play).)

```bash
npm install              # install dependencies
npm test                 # run tests (vitest)
npm run typecheck        # type check
npm run dicelore -- new <session-name>   # CLI: create / open a session (dev / session management)
```

To actually play during development you also need to start the `backend` and the `frontend` dev server, then open the web client in a browser — the CLI alone does not run a game.

Sessions are saved under the platform's app-data directory at `dicelore/sessions/<name>.db`. The environment variable `DICELORE_DATA_DIR` overrides the root directory; `DICELORE_SESSION` sets the default session name.

**Tech stack**: TypeScript + better-sqlite3 (authoritative state externalised) · MCP (`@modelcontextprotocol/sdk` v1.x + Zod v3, inner capability library packaged as a set of `dicelore_*` tools) · FTS5 + jieba Chinese full-text search (trigram zero-dependency fallback).

---

## License and Credits

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Dicelore is released under the **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)** — see [LICENSE](LICENSE).

> Copyright (C) 2026 MuLeiSY2021

The key points of AGPL: anyone may freely use, modify, and distribute this software; **but if you modify Dicelore and offer it as a networked service to users (e.g., hosting an online game site), you must also release the corresponding complete source code.**

**Credits**: The "rose without thorns" line came from an offhand remark by a friend — and became the seed of this entire project. Thanks also to every contributor: by submitting a PR you agree that your contribution will be incorporated under the same **AGPL-3.0-or-later** license.
