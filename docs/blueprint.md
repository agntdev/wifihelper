# WiFiGuestBot — Bot specification

**Archetype:** custom

**Voice:** warm and concise — write every user-facing message, button label, error, and empty state in this voice.

A small-owner Telegram bot that lets a host securely store Wi‑Fi profiles and create short‑lived guest access tokens presented as QR codes, one‑tap copyable payloads, or temporary codes; hosts can list, revoke, and manage active guest entries while the bot notifies the owner/admin chat for new creations and revocations.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- home hosts
- small-business owners
- venue staff who hand out guest Wi‑Fi

## Success criteria

- Owner can register at least one Wi‑Fi profile via /setwifi and see a confirmation.
- Owner can create a guest access entry (/newguest) that returns a QR image and a one-tap Copy button or a temporary code, with chosen expiry applied.
- Access tokens include creation and expiry timestamps; expired tokens are automatically removed by a background cleanup job.
- Owner receives a Telegram notification in ADMIN_CHAT_ID when a guest access is created and when revoked.
- Owner can list active guest accesses (/listguests) and revoke an entry (/revoke <id>), which disables the token and notifies admin.

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and show quick actions (Create guest, List guests, Settings)
  - outputs: main menu buttons
- **/setwifi** (command, actor: admin, command: /setwifi) — Register or update a Wi‑Fi profile: prompts for SSID, password, security type
  - inputs: SSID (text), password (text), security type (WPA2/WPA3/WEP/Open)
  - outputs: confirmation message, saved Wi‑Fi profile
- **/newguest** (command, actor: admin, command: /newguest) — Create a new guest access entry (name optional), choose delivery and expiry
  - inputs: guest name (text, optional), note (text, optional), delivery option (button: QR / Text / Temporary code), expiry (slash command entry or quick-select buttons)
  - outputs: QR image (if chosen), plain-text payload (if chosen), temporary code (if chosen), one-tap Copy button
- **Create guest access** (button, actor: admin, callback: guest:create) — Shortcut from main menu to start /newguest flow
  - inputs: initiates /newguest dialog
  - outputs: first prompt (guest name)
- **/listguests** (command, actor: admin, command: /listguests) — List active guest accesses (paginated if > 10), up to max 50 results per brief default
  - inputs: optional page token
  - outputs: list with revoke buttons per entry
- **/revoke** (command, actor: admin, command: /revoke <id>) — Revoke a guest access by id (confirmation required via yes/no inline buttons)
  - inputs: guest id (text)
  - outputs: revocation confirmation, admin notification
- **/settings** (command, actor: admin, command: /settings) — Open settings to change defaults (default expiry, default security type) and manage profiles
  - outputs: settings menu with inline options
- **Copy** (button, actor: guest_or_admin, callback: payload:copy:<token_id>) — One-tap copy button for payloads; triggers ephemeral callback confirmation to the user
  - inputs: callback token_id
  - outputs: confirmation toast via edit or ephemeral message

## Flows

### Register Wi‑Fi profile
_Trigger:_ /setwifi

1. Bot asks for SSID (ForceReply or typed input).
2. Bot asks for password (ForceReply).
3. Bot asks for security type with inline buttons (WPA2/WPA3/WEP/Open) - default WPA2.
4. Owner confirms details.
5. Server stores Wi‑Fi profile encrypted, returns confirmation and shows profile summary.

_Data touched:_ Wi‑Fi profile

### Create guest access
_Trigger:_ /newguest

1. Bot prompts for guest name (optional) and note (optional).
2. Bot shows delivery option buttons: QR, Plain text, Temporary code.
3. Bot asks for expiry (quick buttons: 4h, 12h, 24h (default), 7d, Custom input for hours/datetime).
4. On confirmation, server generates access token/session (includes payload and expiry), generates Wi‑Fi QR payload, and stores token record.
5. Bot returns QR image (if chosen) and/or plaintext payload and a one-tap Copy button; also shows 'Revoke' and 'Save to list' actions.
6. Bot sends admin notification to ADMIN_CHAT_ID with guest summary and revoke link.

_Data touched:_ Guest record, Access token/session, Wi‑Fi profile (read)

### Guest delivery and usage
_Trigger:_ Host shares QR or code with guest

1. Guest scans QR or reads code; router/phone uses payload to join network outside bot.
2. If guest returns to chat and presses Copy, bot confirms copying and logs the delivery attempt (optional).

_Data touched:_ Access token/session

### List and paginate active guests
_Trigger:_ /listguests

1. Bot fetches up to configured page size (default 10, max per brief 50) of active guest entries.
2. Bot displays entries with inline buttons: Revoke, Show details.
3. If more than one page, show Prev/Next pagination buttons using callback_data.

_Data touched:_ Guest record, Access token/session

### Revoke guest access
_Trigger:_ /revoke <id> or inline Revoke button

1. Bot asks for confirmation via inline yes/no.
2. On confirm, server marks token revoked and prevents further use; bot updates any message copies to indicate revoked state.
3. Bot notifies ADMIN_CHAT_ID that the token was revoked (owner-action).

_Data touched:_ Access token/session, Guest record

### Background cleanup and expiry
_Trigger:_ Scheduled job (cron / background worker)

1. Periodic job scans tokens for expiry.
2. Expired tokens are marked inactive and optionally purged after retention policy.
3. If configured, send periodic summary of expired tokens to admin (optional).

_Data touched:_ Access token/session

### Settings management
_Trigger:_ /settings

1. Bot shows defaults: default expiry, default security type, list of Wi‑Fi profiles.
2. Owner can change defaults via inline buttons or edit a profile via /setwifi.
3. Changes saved to persistent settings store.

_Data touched:_ Wi‑Fi profile, Owner settings

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id where new guest access creations and revocations are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Host/admin** _(retention: persistent)_ — Owner account that manages Wi‑Fi profiles and guest access; identified by Telegram chat id
  - fields: admin_id, display_name, preferences (default expiry, default security type)
- **Wi‑Fi profile** _(retention: persistent)_ — Stored network credentials used to create guest payloads (encrypted at rest)
  - fields: profile_id, ssid, password (encrypted), security_type (WPA2/WPA3/WEP/Open), created_at, updated_at, is_default
- **Guest record** _(retention: persistent)_ — Optional metadata about a guest for the owner's convenience
  - fields: guest_id, name, note, created_by (admin_id), created_at
- **Access token/session** _(retention: persistent)_ — Generated payload (QR content and/or temporary code) that represents guest access with expiry and revocation state
  - fields: token_id, guest_id (optional), profile_id, payload_text (e.g. WIFI:... string), qr_image_blob_reference, delivery_mode (QR/text/code), created_at, expires_at, revoked_at, status (active/expired/revoked)
- **Notification record (optional log)** _(retention: persistent)_ — Log of admin notifications sent for audit
  - fields: notification_id, type (created/revoked/expired), token_id, sent_at, delivered_to_admin

## Integrations

- **Telegram** (required) — Bot API messaging, inline keyboards, file (QR image) uploads and callbacks
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Register/update/delete Wi‑Fi profiles (/setwifi)
- Create guest access entries (/newguest or Create guest access button)
- List active guest accesses (/listguests) with pagination
- Revoke individual guest access (/revoke <id> or Revoke button)
- Change defaults (default expiry, default security type) via /settings
- Set or change admin notification target (ADMIN_CHAT_ID) during initial setup
- Force purge expired tokens and export active guest list (export optional)

## Notifications

- Notify ADMIN_CHAT_ID when a new guest access is created (includes guest name, delivery mode, expiry, token id).
- Notify ADMIN_CHAT_ID when a guest access is revoked (who revoked and token id).
- Optional periodic summary of expiring tokens (configurable in settings).

## Permissions & privacy

- Wi‑Fi credentials are stored encrypted at rest; only the owner/admin (ADMIN_CHAT_ID) can create or manage tokens.
- Guest-facing outputs contain only the payload needed to join the Wi‑Fi; the bot does not transmit credentials to third parties.
- Bot cannot change router settings or provision network devices (non-goal).
- Retention: tokens persist until expiry or revoke; expired tokens are auto-cleaned. Owner can delete Wi‑Fi profiles or guest records manually.

## Edge cases

- Owner attempts to create guest access without any Wi‑Fi profile registered — bot must prompt to /setwifi first.
- QR image generation failure (image library error or file upload limit) — fallback to plain text payload and error notification to admin.
- Owner-supplied expiry in the past or malformed custom expiry — validate and reject with friendly prompt.
- Two tokens created simultaneously causing token_id collision — ensure server-side unique id generation.
- Owner forgets to set ADMIN_CHAT_ID — notifications will fail; bot must prompt owner to set it during onboarding.
- Large guest lists > configured max (50) — require pagination and enforce list limits with clear message.
- Guest attempts to use an expired or revoked token — bot should show a clear 'expired/revoked' state when the owner views that token and return a non-actionable message if attempted via callback.
- Time zone ambiguity for expiry — expiry stored in UTC and displayed in owner local TZ with explicit timezone label.
- Message deletion or forwarding: if owner deletes the original QR message, copies already scanned remain valid until token expiry.

## Required tests

- Dialog-level acceptance: full /setwifi flow stores encrypted profile and displays summary.
- Dialog-level acceptance: /newguest with each delivery option (QR, text, temporary code) produces the expected outputs and admin notification.
- Revoke test: revoke via /revoke and via inline button; verify token status updates and admin notification sent.
- Expiry cleanup test: create short-lived token, let it expire, confirm background job marks it expired and it no longer appears in /listguests.
- Pagination test: create > page size tokens and verify /listguests paginates correctly and buttons work.
- Failure modes: simulate QR generation failure and verify plaintext fallback and admin error log.
- Security test: verify stored Wi‑Fi passwords are encrypted at rest and not leaked in logs or notifications.
- Copy-button callback test: pressing Copy returns ephemeral confirmation and does not leak payload to unintended recipients.

## Assumptions

- Default security type is WPA2 unless owner selects otherwise.
- Default expiry is 24 hours; owner can choose other quick-selects or enter custom durations.
- Admin notifications are sent to one ADMIN_CHAT_ID (single-owner model).
- QR payload uses the standard Wi‑Fi QR format (WIFI:T:<type>;S:<ssid>;P:<password>;;).
- Maximum active guest entries shown in one request is 50 (configurable by owner in settings but default per brief).
- The platform provides bot hosting, storage, and scheduled workers so no external API keys are required from the owner.
