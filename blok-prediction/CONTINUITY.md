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

6. **Linear & Clean Sequential Prediction Flow (WOMEN FIRST):**
   - **Step 0 (Details modal):** Participant enters Full Name with `#ffffff` text on solid `#0a0309` cards.
   - **Step 1 (Pick Women's Champion):** Focused view displaying the 5 Women finalists (`Chloé Caulier`, `Janja Garnbret`, `Laura Rogora`, `Oriane Bertone`, `Ai Mori`). Tap to select, then click `"NEXT: SET HER SCORE →"`.
   - **Step 2 (Women's IFSC Score - Hero Scorecard):** Large, elegant scorecard displaying:
     1. Athlete's chosen name first in large poster type (`JANJA GARNBRET`),
     2. Live predicted score badge (`4T4z 4 4`),
     3. Official `4 BOULDERS` competition badge,
     4. High-contrast tactile pills for Tops (0..4), Zones (0..4), and attempts steppers.
     5. Redundant instruction sentences eliminated.
     Click `"NEXT: PICK MEN'S CHAMPION →"`.
   - **Step 3 (Pick Men's Champion):** Focused view displaying the 5 Men finalists (`Hannes Van Duysen`, `Simon Lorenzi`, `Alex Megos`, `Adam Ondra`, `Tomoa Narasaki`). Tap to select, then click `"NEXT: SET HIS SCORE →"`.
   - **Step 4 (Men's IFSC Score - Hero Scorecard):** Large, elegant scorecard displaying:
     1. Athlete's chosen name first in large poster type (`ADAM ONDRA`),
     2. Live predicted score badge (`3T4z 6 5`),
     3. Official `4 BOULDERS` competition badge,
     4. High-contrast tactile pills for Tops (0..4), Zones (0..4), and attempts steppers.
     Click `"⚡ LOCK IN PREDICTIONS →"`.
   - **Confirmation Receipt:** Displays Women's Pick first and Men's Pick second.
   - **Full Back Navigation:** Each step has a functioning `← BACK` button preserving previous choices.
7. **Organized & Minimalist Admin Panel:**
   - Clean, modular 4-card structure: Competition Status, Podium Lucky Draw Tool, Live Submissions & Stats Overview, and a secured collapsible Danger Zone.
   - **Instant Optimistic Toggling:** The predictions toggle button (`#toggleOpen`) updates the UI instantly (turning the status badge and button red for closed, yellow for open) with zero latency, and syncs to Supabase in the background. Gating `!isAdmin` check and blocking `window.confirm` dialogs removed.
   - **Safe Data Reset:** `#clearData` relocated to the very bottom inside a closed `<details class="admin-danger-zone">`, protected by a typed prompt requiring `"RESET"` in uppercase to prevent accidental data wipes.
8. **Test Mode (Name-Only & 100 Seeded Voters):**
   - **Name-Only Voting:** Form simplified to ask only for Full Name (email and phone hidden/optional). No duplicate blocking — users can submit multiple votes for testing without restrictions.
   - **100 Seeded Predictions:** Database populated with 100 realistic community votes distributed across the 10 finalists (Janja ~25%, Toby ~18%, Hannes ~17%, Sorato ~12%, Oriane ~9%, etc.), ready for testing the winner publication, crowd odds scoreboard, and lucky draw raffle.
9. **Strict Copywriting & Street Tone (DO NOT TOUCH):**
   - The user specifically authored the current wording in a casual, punchy street/urban climbing tone (`WHO WILL WIN tonight's FINALs?`, `PLACE YOUR BETS`, `FAN FAVORITES`, `NEXT`, `YOUR first and last NAME`, etc.).
   - **MANDATE:** Do NOT alter, rewrite, or touch any text, wording, or titles. Keep all copy verbatim as the user left it.
10. **Boulder Grand Final Dual IFSC Prediction & Scoring Engine:**
   - **User Prediction:** Spectators predict both Men's Champion (1 male athlete) and Women's Champion (1 female athlete) along with their exact IFSC final score across 4 boulders (`XT Yz A B`, e.g. `3T4z 6 5` = 3 Tops, 4 Zonas, 6 intentos a Top, 5 intentos a Zona).
   - **Strict IFSC Validation:** `tops` $\in [0, 4]$, `zones` $\in [0, 4]$, `zones >= tops`. If `tops == 0` $\rightarrow$ `att_top = 0`; if `tops > 0` $\rightarrow$ `att_top >= tops`. If `zones == 0` $\rightarrow$ `att_zone = 0`; if `zones > 0` $\rightarrow$ `att_zone >= zones`.
   - **Scoring Formula (per category, max 135 pts each, 270 pts total):**
     - Correct winner name: +50 pts.
     - Tops closeness: `max(0, 20 - abs(pred_tops - real_tops) * 5)`.
     - Zones closeness: `max(0, 15 - abs(pred_zones - real_zones) * 4)`.
     - Top attempts closeness: `max(0, 15 - abs(pred_att_top - real_att_top) * 2)`.
     - Zone attempts closeness: `max(0, 10 - abs(pred_att_zone - real_att_zone) * 2)`.
     - Full exact match bonus: +25 pts extra (winner + exact IFSC combination).
   - **Tiebreaker:** (1) Highest total points, (2) Lowest attempt difference across both categories, (3) Lowest Tops/Zones score difference. If tied on all, all are declared winners on the podium.
   - **Admin Official Results Entry:** Box 2 has dropdowns for Men & Women champions with Tops, Zones, and Attempts inputs + live preview badges + `⚡ CALCULATE POINTS & PICK WINNERS →` button.
   - **100 Seeded Community Predictions:** Ready out of the box with realistic IFSC scores, with a one-click `🎲 SEED 100 TEST VOTERS` button in admin.

## How to Test Locally

Run:
```bash
python -m http.server 8000
```
And open `http://127.0.0.1:8000`.


## Supabase Readiness

The database schema (`supabase-schema.sql`) is ready to run in Supabase. Paste project URL and anon key into `supabase-config.js` when ready to go live.

