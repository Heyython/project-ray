# heyyth-site 💌 (v2 — GitHub-backed accounts, profiles & messaging)

A full personal website: loading screen → login → a personal wiki page →
gallery → vault (private per-browser file manager) → anonymous messages
→ **account search, profiles, and private messaging** → plus a whole
hidden second area of "other projects" (CYNE, SONICFLOW, BUILDCORE,
ARCHIVE, EXPERIMENTAL, and Socials) tucked behind one button.

Theme: dark navy + pink, cute, not corny.

This is a straight upgrade of the previous static version: everything
that existed before (Vault, Gallery, Projects Hub, Anonymous Messages,
loading screen, styling) is untouched. What's new is a **real account
system** — Search, Profiles, and Messages — backed by a GitHub
repository instead of a database.

---

## Architecture

```
        GITHUB (private data repo)
     accounts · permissions · profiles
        pfps · messages · settings
                    │
              GitHub REST API
                    │
        SECURE BACKEND  (backend/ folder — deployed separately)
   auth · session cookies · permission checks · GitHub reads/writes
                    │
             HTTPS + cookie
                    │
        THIS SITE  (GitHub Pages — what you're looking at)
      login · search · profiles · messages · everything else
```

**GitHub is the only persistent data store.** There is no Supabase,
Firebase, Postgres, Mongo, or any other database anywhere in this
system. The backend holds no data of its own — restart it any time and
nothing is lost, because nothing lives there in the first place.
Account data, profiles, permissions, and messages all live as plain,
human-readable JSON files in a GitHub repo, and every change to them is
a real Git commit.

### Why two repos?

This matters, so it's worth explaining up front. GitHub Pages serves
**every file** in the branch/folder it's pointed at — there's no way to
tell it "publish index.html but not data/accounts.json." Since one of
the hard requirements here is that account credentials must never be
downloadable by a visitor, the only clean way to guarantee that is to
keep the data somewhere Pages never touches:

- **`heyyth-site`** (this repo) — public, GitHub Pages-enabled. Only
  ever contains the static site: HTML/CSS/JS, the gallery, the projects
  hub. No account data, ever.
- **`heyyth-data`** (a *second*, private repo you create — see
  `heyyth-data-template/` in this deliverable) — holds `data/`,
  `profiles/`, `messages/`. Nothing here is ever served to a browser
  directly. Only the backend, holding a GitHub token you control, can
  read or write it.

If you'd rather keep everything in one repo, you can — but then that
one repo **must** be private, and even then, don't turn on GitHub Pages
for it from a branch that contains the data folders (Pages on private
repos also requires a paid GitHub plan). The two-repo split is the
version that works on GitHub's free tier with a public site, which is
almost certainly what you want.

---

## What's new vs. what's unchanged

**Unchanged, exactly as before:**
- Loading screen, main wiki page, central `config/site.config.js`
- Gallery (still just files in `gallery/images/` + config entries)
- Vault (still a private, per-browser file manager using
  `localStorage`/`IndexedDB` — see "Vault & Anonymous Messages" below
  for why this one deliberately did *not* move to GitHub)
- Anonymous Messages (still per-browser, same reasoning)
- The Projects Hub and all six projects (CYNE, SONICFLOW, BUILDCORE,
  ARCHIVE, EXPERIMENTAL, Socials) — completely untouched

**New:**
- Login now authenticates against real accounts stored in GitHub,
  through a backend (no more "any new username creates an account")
- **Search** — find accounts you have permission to see
- **Profiles** — view display name/bio/picture; edit your own
- **Messages** — private 1:1 conversations, unread badges, stored in
  GitHub

---

## Deploying

### 1. The private data repo

1. Create a new **private** GitHub repository (e.g. `heyyth-data`).
2. Push the contents of `heyyth-data-template/` (included in this
   deliverable) into it — that gives you `data/accounts.json`,
   `data/permissions.json`, `data/settings.json`, two example profiles,
   and an empty `messages/conversations/` folder.
3. Edit `data/accounts.json` to set up your real accounts (see
   "Accounts" below, and the README inside `heyyth-data-template/`).

### 2. The backend

1. Take the `backend/` folder from this deliverable.
2. Create a GitHub Personal Access Token scoped to just the data repo
   (a fine-grained PAT with "Contents: Read and write" on that one
   repo is the safest choice).
3. Deploy `backend/` to any Node host (Render, Railway, Fly.io, a VPS —
   see `backend/README.md` for step-by-step Render instructions).
4. Set its environment variables: `GITHUB_TOKEN`, `GITHUB_OWNER`,
   `GITHUB_REPO` (the **data** repo), `GITHUB_BRANCH`, `SESSION_SECRET`,
   `FRONTEND_ORIGIN` (your Pages URL), `NODE_ENV=production`.
5. Note the HTTPS URL your host gives you.

### 3. The website (this repo)

1. Open `config/site.config.js` and set `apiBaseUrl` to the backend's
   URL from step 2.4.
2. Push this folder to a public GitHub repo.
3. Repo Settings → Pages → source branch `main`, folder `/ (root)`.
4. Live at `https://<your-username>.github.io/<repo-name>/`.

All paths in this project are relative, so it works whether it's served
from a domain root or a subfolder.

---

## How login works now

1. You type a username + password into the login form.
2. The frontend sends them as plain JSON to the backend, over HTTPS —
   HTTPS is what protects them in transit, not any client-side
   encoding.
3. The backend looks up that username in `data/accounts.json` (fetched
   from the private data repo, cached briefly), converts the given
   password to Base64, and compares it against the stored
   `passwordBase64`.
4. If it matches, the backend signs a session token and sets it as an
   **httpOnly cookie** — JavaScript in the browser can't read it, only
   the browser automatically sends it back on future requests.
5. The frontend never sees the account database, never sees anyone
   else's credentials, and never holds a GitHub token.

There's no self-service signup — accounts are created by editing
`data/accounts.json` directly (see `heyyth-data-template/README.md`).
That's intentional: this is a small, personal, invite-only system, not
a public sign-up service.

**On Base64:** it's encoding, not encryption. Anyone who got hold of
`passwordBase64` could decode it in one line (`atob(...)`). It's used
here purely because you asked to be able to see/edit credential values
by hand in GitHub. The actual protection is that the data repo is
private and only the backend's token can read it — never that the
values are Base64.

---

## How account visibility (search/profiles/messaging) works

Every account has an entry in `data/permissions.json`:

```json
{
  "ac1": ["ac2"],
  "ac2": ["ac1"]
}
```

`"ac1": ["ac2"]` means ac1 can search for, view the profile of, and
message ac2. It says nothing about the reverse. If ac2 isn't on ac1's
list, ac2 doesn't just get hidden from ac1 — every backend endpoint
(search, profile, pfp, messages) treats it identically to "this account
doesn't exist": same 404, same error text, no code path that could let
someone infer it's actually just hidden rather than absent.

You control all of this by hand-editing `data/permissions.json` in the
private data repo — no UI for it exists on purpose, since granting
visibility is something you'd want to do deliberately, not something a
website visitor should self-serve.

---

## How messages are persisted

Every pair of accounts that has ever messaged each other gets exactly
one file:

```
messages/conversations/ac1_ac2.json
```

(named by sorting the two account IDs and joining with `_` — so it
doesn't matter who messaged whom first, there's always one canonical
file). It looks like:

```json
{
  "participants": ["ac1", "ac2"],
  "messages": [
    {
      "id": "msg_1730000000000_ab12cd",
      "sender": "ac1",
      "receiver": "ac2",
      "content": "hey",
      "timestamp": "2026-09-20T10:00:00Z",
      "read": false
    }
  ]
}
```

Sending a message is a real Git commit to this file. If two people
message each other at almost the same moment, GitHub will reject the
second write because the file changed underneath it (a SHA mismatch);
the backend catches that, re-fetches the now-current file, re-applies
the new message on top, and retries — so the two messages both land
safely instead of one silently overwriting the other. See
`backend/src/github.js`'s `updateJSONWithRetry` if you want to read the
actual retry logic.

Opening a conversation triggers a fetch of that one file (not the whole
message store) and marks anything addressed to you as read, which is
another small commit. Because GitHub is a Git host, not a realtime
database, the Messages tab polls gently — every 20 seconds while you
have it open, and once immediately when you open a conversation — it
does **not** poll continuously in the background from every screen.

---

## Deviations from the original spec (and why)

A few implementation choices differ slightly from the literal spec, on
purpose:

- **One conversation file per pair, not one folder per account with
  duplicate files on each side.** The spec's sketch had
  `messages/ac1/conversation_ac2.json` *and*
  `messages/ac2/conversation_ac1.json` as separate files. Keeping a
  single canonical file avoids a much worse concurrency problem (every
  message send would need two separate, non-atomic GitHub commits that
  could drift out of sync) for zero benefit — both participants are
  still only ever shown their own conversation.
- **`POST /api/messages/:accountId/read` instead of
  `POST /api/messages/:id/read`.** Marking an entire conversation's
  unread messages as read in one call is simpler and doesn't require
  the backend to trust a client-supplied message ID as a lookup key
  into a specific file — it already knows which conversation file to
  open from the accountId route param and the caller's own session.
- **No public self-signup.** The spec describes a login system but
  never a signup UI; accounts are provisioned by hand in
  `data/accounts.json`, which fits a small, personal, permissioned site
  better than an open registration flow.

Everything else follows the spec as given.

---

## Vault & Anonymous Messages: why these stayed browser-local

These two features predate this GitHub-backed system and aren't part
of the account/profile/messaging spec that introduced it. Moving them
to GitHub would mean either (a) exposing per-account file uploads and
free-text anonymous messages to the same public-repo-exposure problem
this whole two-repo split exists to avoid, or (b) routing them through
the backend for no real benefit, since they were always meant to be a
private, personal-device scratchpad and a "leave me a note" board
respectively. They still work exactly as before — see the "Vault" and
"Anonymous Messages" sections in the site itself, and
`js/storage.js`, unchanged.

---

## Security checklist

- ✅ GitHub token lives only in the backend's environment variables,
  never sent to the frontend, never committed (`.env` is gitignored;
  `.env.example` has placeholders only)
- ✅ Sessions are httpOnly cookies (JS can't read them) — no token,
  password, or credential of any kind touches `localStorage`,
  `sessionStorage`, or a URL
- ✅ `data/accounts.json` lives in the private data repo, never in the
  Pages-published repo — a visitor cannot download it, full stop
- ✅ Login only ever checks one account's credentials server-side; the
  full account list is never sent to the browser
- ✅ Every protected endpoint re-derives "who is this" from the signed
  session, never from an accountId in the request body/params
- ✅ Search, profile, and message access all use the same rule: allowed
  by `permissions.json`, or it's a 404 — hidden accounts are
  indistinguishable from nonexistent ones at every endpoint
- ✅ Profile edits and picture uploads always target the session's own
  account — there is no code path that takes a target accountId for a
  write
- ✅ Concurrent message writes use GitHub's file SHA to detect
  conflicts and retry safely, never silently dropping a message
- ✅ Base64 is documented (here and in the data repo's README) as
  encoding, not encryption, everywhere it's used
- ⚠️ **Cross-site cookie caveat:** the site (GitHub Pages) and the
  backend are different origins, so the session cookie is set with
  `SameSite=None; Secure`. Some browsers' third-party-cookie
  restrictions can interfere with this. If you hit login issues that
  look like "it works then silently logs out," the most reliable fix
  is putting the backend behind a custom subdomain of the same domain
  you use for the site (e.g. `api.yoursite.com` alongside a custom
  domain on Pages), which makes the cookie first-party.

---

## Central config

Almost everything text-based (that isn't account/profile/message data)
still lives in one file:

```
config/site.config.js
```

Edit this to change your name, tagline, about text, interests,
favorites, facts, loading messages, theme colors, the gallery array,
socials, the Projects Hub cards, sample anonymous messages, and now
also `apiBaseUrl` (the backend URL).

---

## Adding gallery images

1. Drop the image file into `gallery/images/`.
2. Add an entry to the `gallery` array in `config/site.config.js`:

```js
{
  id: "g4",
  file: "my-new-photo.jpg",
  caption: "caption goes here",
  date: "2026-06-01",   // optional
  category: "trips"     // optional, used for the filter chips
}
```

---

## Changing socials

Edit the `socials` array in `config/site.config.js`. Each entry needs a
`platform`, `username`, `icon` (`instagram`, `snapchat`, `discord`, or
`x`), and an optional `url`.

---

## Adding a new "Other Project"

1. Add a card entry to the `projects` array in `config/site.config.js`
   (`id`, `name`, `tagline`, `color`).
2. Create `projects/<id>.html` — self-contained, with a `← back` link
   to `index.html`. Copy an existing project page as a template.

---

## Accounts, permissions, profiles, messages — day-to-day editing

All of this lives in the **private data repo**, not here. Short version
(full detail in `heyyth-data-template/README.md`):

- **Add an account:** add an entry to `data/accounts.json` with the
  next free ID (`ac3`, `ac4`, ...), a username, and Base64-encoded
  password. Add a corresponding entry (even if empty, `[]`) to
  `data/permissions.json`.
- **Change who can see whom:** edit `data/permissions.json` directly.
  Remember it's directional.
- **Edit a profile by hand:** edit `profiles/<id>/profile.json`
  directly — the site reads it fresh (with a short cache) rather than
  keeping its own copy.
- **Read someone's messages (as the site owner):** open
  `messages/conversations/<idA>_<idB>.json` — it's a plain, readable
  JSON array.

Manual edits to any of these take effect the next time the backend's
short cache expires (a few seconds to ~30s depending on the file — see
`backend/src/data.js`), no redeploy needed.

---

## Project structure

```
heyyth-site/                     (this repo — public, GitHub Pages)
├── index.html                    # loading + login + main app (SPA)
├── css/style.css
├── js/
│   ├── storage.js                 # Vault + Anonymous Messages (unchanged, browser-local)
│   ├── api.js                     # NEW — backend client (cookie-based, no token)
│   └── app.js                     # UI logic (login/search/profile/messages added)
├── config/site.config.js         # site content + apiBaseUrl
├── gallery/images/
├── projects/                      # unchanged — hub + 6 projects
├── .nojekyll
└── README.md                      # this file

backend/                          (separate deployable — NOT served by Pages)
├── server.js
├── src/
│   ├── github.js                  # the only module that talks to GitHub
│   ├── cache.js                   # ephemeral TTL cache, not a data store
│   ├── data.js                    # cached accounts/permissions/profiles/settings reads
│   ├── session.js, requireAuth.js # stateless JWT-in-httpOnly-cookie auth
│   ├── utils.js                   # accountId validation (path-traversal guard)
│   └── routes/
│       ├── auth.js                # login, logout, me
│       ├── search.js              # permission-scoped search
│       ├── profile.js             # view/edit profile, pfp upload + proxy
│       └── messages.js            # inbox, thread, send, mark-read
├── .env.example
├── .gitignore
├── package.json
└── README.md

heyyth-data-template/             (push this into your OWN new private repo)
├── data/accounts.json
├── data/permissions.json
├── data/settings.json
├── profiles/ac1/profile.json
├── profiles/ac2/profile.json
├── messages/conversations/        (starts empty)
└── README.md
```

---

## Notes

- SONICFLOW's tracks are synthesized in the browser with the Web Audio
  API — no copyrighted audio bundled, fully functional.
- GitHub's API has real rate limits (5,000 requests/hour for an
  authenticated token on a personal account). The backend's caching
  (accounts/permissions ~20s, profiles ~15s, conversation listing ~8s)
  and the frontend's 20-second Messages polling are both there to keep
  this site nowhere near that ceiling under normal personal-site
  traffic. Don't remove the caching or drop the poll interval much
  lower without keeping this in mind.
