# Arachnid of Insite

An experimental Akinator-style guessing game where the Spider of Lore attempts to deduce the character you have in mind. Players answer a sequence of yes / no / unsure questions, the spider makes up to three guesses, and the entire encounter is logged back to the Web of Knowledge via a Netlify Function that commits session data to GitHub.

## Project layout

```
web-of-knowledge/
├── netlify/
│   └── functions/
│       └── submit.js           # Receives session payloads and commits them to GitHub
├── netlify.toml                # Netlify build + redirects configuration
└── src/
    ├── data/
    │   └── knowledge.json      # Seed questions and character fingerprints
    ├── game.js                 # Client-side inference + UI orchestration
    ├── index.html              # Application shell
    └── style.css               # Frosted-glass inspired styling
```

## Getting started

1. Install dependencies for local development (a static server is enough):

   ```bash
   npm install -g serve # or any static file server you prefer
   serve web-of-knowledge/src
   ```

2. In Netlify, configure the required environment variables so the logging function can commit to GitHub:

   - `GITHUB_TOKEN` – personal access token with `contents:write`
   - `GITHUB_REPO` – e.g. `your-user/Arachnid-of-Insite`
   - `GITHUB_BRANCH` – optional, defaults to `main`
   - `GITHUB_COMMITTER_NAME` / `GITHUB_COMMITTER_EMAIL` – optional overrides

3. Deploy to Netlify. The site publishes the `src/` directory and exposes the logging function at `/.netlify/functions/submit`.

## Gameplay loop

- The Spider chooses the most informative unanswered question using a simple entropy-based heuristic with a hint of randomness to keep sessions varied.
- Character probabilities are continuously adjusted—never fully eliminating any candidate to account for user error.
- After at most 24 questions the Spider offers up to three guesses. Whether correct or not, players can reveal the true character, suggest new characters, and propose new questions.
- The entire session (answers, guesses, and player contributions) is sent to the Netlify Function which archives it inside the repository under `data/session-<timestamp>.json`.

Future enhancements could expand the `knowledge.json` seed set, analyse the archived sessions to refine probabilities, and dynamically grow the question bank.
