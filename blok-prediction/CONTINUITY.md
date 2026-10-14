# Continuity Guide — BLOK OPEN XXL

## Current Status

The application has been transformed to match the official **BLOK OPEN XXL** event identity from Klimzaal Blok (Hoboken, Antwerp, 24.10.2026):

1. **Schedule & Timing:**
   - Finals begin at **20:30**.
   - Predictions close at **20:00**.
   - Date: **24.10.2026**.
2. **Language & Localization:**
   - Completely in English (international climbing audience in Antwerp/Benelux).
   - Event presenters: **K2 × TENAYA PRESENT**.
   - Athletes Prize pool: **€7,000 PRIZE MONEY** (for podium competitors on the wall). Spectators enter the raffle for merch & goodies.
3. **Visual Identity & Authentic Bouldering Aesthetic:**
   - Moved away from generic "AI dark SaaS" cards (no rounded glassmorphic pills, no glowing dots).
   - Genuine urban bouldering & street poster look inspired by Klimzaal Blok:
     - Condensed poster typography (`Bebas Neue` for titles, `Syne` for headings).
     - Raw competition tags & timestamps in `Space Mono` (`[ LOCKS // 20:00 ]`, `BIB #01`).
     - Real physical metaphors: climbing finger tape tags (`.tape-tag`), brutalist offset block shadows (`box-shadow: 4px 4px 0 var(--mauve)`), and competition scorecard style for athlete picks.
     - Gritty duotone flyer background showing chalk-dusted hands and taped fingers.
4. **Gamification & Lucky Draw:**
   - **Live Crowd Odds:** Computes live prediction percentages per climber with sleek progress bars.
   - **Lucky Draw Raffle:** In the admin panel, organizers can draw a random winner among all participants who correctly predicted the champion, displaying their contact info for the MC / podium ceremony.
   - The raffle winner also appears on the public results screen.
5. **Database & Technical:**
   - Unique constraint updated to prevent multiple entries per contact (email/phone), without blocking distinct participants who share the same first name.
   - GDPR privacy note displayed for contact input.
   - Schema includes `raffle_winner` in `event_settings`.

6. **Two-Step Clean Prediction Flow:**
   - **Step 1 (Details modal):** High-contrast participant inputs (Name, Email, Phone) with `#ffffff` text on solid `#0a0309` cards.
   - **Step 2 (Athlete picker):** Strictly **no-scroll view** (`100dvh`, `overflow: hidden`) featuring 5 Men and 5 Women finalists with segmented category switcher (`MEN (5)` / `WOMEN (5)`).
7. **Organized & Minimalist Admin Panel:**
   - Clean, modular 4-card structure: Competition Status, Podium Lucky Draw Tool, Live Submissions & Stats Overview, and a secured collapsible Danger Zone.
   - **Instant Optimistic Toggling:** The predictions toggle button (`#toggleOpen`) updates the UI instantly (turning the status badge and button red for closed, yellow for open) with zero latency, and syncs to Supabase in the background. Gating `!isAdmin` check and blocking `window.confirm` dialogs removed.
   - **Safe Data Reset:** `#clearData` relocated to the very bottom inside a closed `<details class="admin-danger-zone">`, protected by a typed prompt requiring `"RESET"` in uppercase to prevent accidental data wipes.
8. **Test Mode (Name-Only & 100 Seeded Voters):**
   - **Name-Only Voting:** Form simplified to ask only for Full Name (email and phone hidden/optional). No duplicate blocking — users can submit multiple votes for testing without restrictions.
   - **100 Seeded Predictions:** Database populated with 100 realistic community votes distributed across the 10 finalists (Janja ~25%, Toby ~18%, Hannes ~17%, Sorato ~12%, Oriane ~9%, etc.), ready for testing the winner publication, crowd odds scoreboard, and lucky draw raffle.

## How to Test Locally

Run:
```bash
python -m http.server 8000
```
And open `http://127.0.0.1:8000`.


## Supabase Readiness

The database schema (`supabase-schema.sql`) is ready to run in Supabase. Paste project URL and anon key into `supabase-config.js` when ready to go live.

