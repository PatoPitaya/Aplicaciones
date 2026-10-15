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
4. **Gamification & Dual IFSC Scoring:**
   - **Live Crowd Odds:** Computes live prediction percentages per climber with sleek progress bars before results are announced.
   - **Contest Leaderboard:** After organizers declare the official IFSC scores, the public screen crowns the #1 Grand Winner(s) and displays the full ranked leaderboard sorted by total points and IFSC tiebreaker closeness. (Lucky Draw raffle discontinued in favor of skill-based IFSC scoring).
5. **Database & Technical:**
   - Unique constraint updated to prevent multiple entries per contact (email/phone), without blocking distinct participants who share the same first name.
   - GDPR privacy note displayed for contact input.
   - Dual IFSC prediction encoding compactly stored for both categories.

6. **Linear & Clean Sequential Prediction Flow (WOMEN FIRST):**
   - **Step 0 (Details modal):** Participant enters Full Name with `#ffffff` text on solid `#0a0309` cards.
   - **Step 1 (Pick Women's Champion):** Focused view displaying the 5 Women finalists (`Chloé Caulier`, `Janja Garnbret`, `Laura Rogora`, `Oriane Bertone`, `Ai Mori`). Tap to select, then click `"NEXT: SET HER SCORE →"`.
   - **Step 2 (Women's IFSC Score - Hero Scorecard):** Large, elegant scorecard displaying:
     1. Athlete's chosen name first in large poster type (`JANJA GARNBRET`),
     2. Live predicted score badge (`4T4 4Z4`),
     3. Official `4 BOULDERS` competition badge,
     4. High-contrast tactile pills for Tops (0..4), Zones (0..4), and attempts steppers.
     5. Redundant instruction sentences eliminated.
     Click `"NEXT: PICK MEN'S CHAMPION →"`.
   - **Step 3 (Pick Men's Champion):** Focused view displaying the 5 Men finalists (`Hannes Van Duysen`, `Simon Lorenzi`, `Alex Megos`, `Adam Ondra`, `Tomoa Narasaki`). Tap to select, then click `"NEXT: SET HIS SCORE →"`.
   - **Step 4 (Men's IFSC Score - Hero Scorecard):** Large, elegant scorecard displaying:
     1. Athlete's chosen name first in large poster type (`ADAM ONDRA`),
     2. Live predicted score badge (`3T6 4Z5`),
     3. Official `4 BOULDERS` competition badge,
     4. High-contrast tactile pills for Tops (0..4), Zones (0..4), and attempts steppers.
     Click `"⚡ LOCK IN PREDICTIONS →"`.
   - **Confirmation Receipt:** Displays Women's Pick first and Men's Pick second.
   - **Full Back Navigation:** Each step has a functioning `← BACK` button preserving previous choices.
7. **Organized & Minimalist Admin Panel:**
   - Clean, modular structure: Section 1 (Event Control & Betting Status), Section 2 (Official Finals Results Form & Calculation), Section 3 (Live Entries Feed & Statistics with one-click 100 test voter seed), and Section 4 (Safe collapsible participant records deletion).
   - **Instant Optimistic Toggling:** The predictions toggle button (`#toggleOpen`) updates the UI instantly (turning the status badge and button red for closed, yellow for open) with zero latency, and syncs to Supabase in the background. Gating `!isAdmin` check and blocking `window.confirm` dialogs removed.
   - **Safe Data Reset:** `#clearData` relocated to the very bottom inside a closed `<details class="admin-danger-zone">` to prevent accidental data wipes.
8. **Test Mode (Name-Only & 100 Seeded Voters):**
   - **Name-Only Voting:** Form simplified to ask only for Full Name (email and phone hidden/optional). No duplicate blocking — users can submit multiple votes for testing without restrictions.
   - **100 Seeded Predictions:** Database populated with 100 realistic community votes distributed across the 10 finalists (Janja ~25%, Toby ~18%, Hannes ~17%, Sorato ~12%, Oriane ~9%, etc.), ready for testing the winner publication, crowd odds scoreboard, and dual IFSC points ranking.
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

11. **Unified Street Logo Identity ("BLOK" + Tilted Tape Sticker "OPEN XXL"):**
    - Consistent across all 8 views in the application (`welcome-view`, `register-view`, `pick-woman-view`, `score-woman-view`, `pick-man-view`, `score-man-view`, `success-view`, `results-view`).
    - Markup: `<a class="logo logo-small" href="#home"><span class="logo-mark">BLOK</span><span class="logo-sticker">OPEN XXL</span></a>`.
    - Aesthetic:
      - `BLOK`: Chalk-white bold poster typography (`Bebas Neue`, 27px, hard drop-shadow).
      - `OPEN XXL`: Urban climber finger-tape sticker with soft desaturated yellow tape (`#ebd87e`), handwritten permanent marker font (`Permanent Marker`), deep pink lettering (`#a32353`), transform angle `-3.5deg`, and serrated torn tape edges.
      - Styled as if slapped on by hand (ladeado), matching the confirmed receipt sticker aesthetic.

12. **Organizer Console Visual Differentiation & Tape Patch Aesthetic:**
    - **Soft Desaturated Colors (-10% saturation)**: Soft matte tape yellow (`#ebd87e`) and extra-soft pale chalk pink (`#ceabb8`).
    - **Handwritten Finger Tape Patches (`Permanent Marker`)**: Applied to all stickers across the app (`OPEN XXL`, `CONFIRMED` stamp, and large organizer category banners).
    - **Large Category Tape Banners**: 16px permanent marker font with 6px 14px 5px padding and torn tape edges for `WOMEN'S CHAMPION` and `MEN'S CHAMPION`.
    - **No OS Default Blue Selects**: `<select>` dropdowns branded with custom SVG chevrons, respective yellow and pink focus rings, and yellow/pink `:checked` option backgrounds.
    - **Event Control Neon**: Yellow neon when predictions are `OPEN` with large handwritten tape badge; dynamically switches to Red neon and red tape badge when `CLOSED`.
    - **Live Entries Green Neon**: Green neon glow (`#34d399`) on Section 3 with high-contrast spectator statistics.
    - **Animated Soft Neon Glow (`@keyframes softNeonAura`)**: The official results container has a gentle, breathing aura shifting between soft yellow and soft pink. Glow intensities reduced by 30% for a subtle, glare-free aesthetic.
    - **High-Contrast IFSC Labels (`TOPS`, `ATT. TOPS`, `ZONE`, `ATT. ZONE`)**: Enlarged from 9px to 11.5px/12px bold (`800`) monospace with pure chalk white (`#ffffff`), providing clear legibility against dark background blocks across both admin inputs and spectator scoring selectors.

13. **Mobile Gesture Navigation & History API (No App Exits on Swipe):**
    - **History API Synchronization**: Every step transition in `showView(viewName)` updates `history.pushState({ view: viewName }, '', '#' + viewName)`.
    - **Organizer Drawer History Protection**: Opening the admin console (`ORG. ↗`) registers `{ view, panel: 'admin' }` with `history.pushState`. When swiping back or pressing back while inside the console, `popstate` intercepts it and closes the drawer with `setPanel(false, false)` without exiting or reloading the application.
    - **Native Edge-Swipe & Browser Back**: `popstate` event intercepts backward gestures on iOS Safari and Android Chrome, returning to the previous view within the SPA without exiting or closing the website.
    - **Touch Swipe-Right Detection**: Global `touchstart`/`touchend` listeners and a dedicated listener on `adminPanel` detect horizontal right-swipes, triggering smooth backward view transitions or closing the admin drawer if open.
    - **Overscroll Lock & Touch Action**: `overscroll-behavior: none` and `touch-action: pan-y` on `html, body, .app-frame, .admin-panel` disable destructive pull-to-refresh and horizontal navigation rubber-banding in mobile browsers.
14. **Contest Leaderboard — Authentic Bouldering Cards + Neon Yellow Winners (CONTEST LEADERBOARD screen):**
    - **Aesthetic integrity:** Preserves the original bouldering card aesthetic (dark card container with offset brutalist shadows, brand typography, yellow cards) without stripping the UI framework.
    - **Specific modifications applied:**
      1. **Official Boulder Champions (`.champions-grid`):** "FINALS CHAMPIONS" / "OFFICIAL BOULDER CHAMPIONS" tape tag removed. Champions displayed in two yellow boxes (`.champ-box`) with soft yellow neon glow and realistic climbing chalk/magnesium dust hand-smudges (`radial-gradient` white dust streaks). Each climber's name is on physical athletic finger-tape (`.champ-name-tape`, tilted with micro-weave cloth texture, dashed cuts, and chalk thumbprints spilling onto the yellow box) and their official IFSC score pill (`.champ-score-pill`, `4T4 4Z4`) clearly visible below.
      2. **Contest Winners (`.podium-card`):** Preserves the classic yellow podium card with soft yellow neon glow and authentic climbing chalk hand-smudges. Multiple winners are rendered as separate individual cards ("los nombres haslos aparte"). Each card prominently features the winner's name on large finger-tape (`.podium-name-tape`), their total points (`.podium-points`, `270 PTS / 270`), and their full predicted IFSC scores and points breakdown (`.podium-scores-grid`) for Women (Yellow) and Men (Mauve/Pink).
      3. **Full Participant Leaderboard (`.leaderboard-wrap`):** Preserves the authentic dark card container with border and brutalist offset shadow. In each `.lb-entry`, Men's pick is placed directly **below** Women's pick:
         - **Women (`.lb-pick-women`):** The `W:` tag and the predicted score (`4T4 4Z4`) are rendered in distinct **Tape Yellow** (`var(--tape-yellow)`).
         - **Men (`.lb-pick-men`):** The `M:` tag and the predicted score (`4T4 4Z5`) are rendered in distinct **Mauve / Pink** (`var(--mauve-bright)`).
         - Neither score gets cut off or truncated on mobile screens, with total points prominently displayed on the right.
      4. **Community Predictions in Fan Favorites View:** When official results are not yet declared (`FAN FAVORITES` view), the crowd odds progress bars for Women and Men are followed by the complete community predictions leaderboard (`COMMUNITY PREDICTIONS`). Participants can scroll down smoothly to see all bets (`W:` and `M:` picks/scores with `[ LOCKED ]` badge). Fixed nested scroll trap by removing restrictive inner `max-height: 520px` from `.leaderboard-list` and enabling hardware-accelerated touch momentum scrolling on `.app-frame`.

## How to Test Locally

Run:
```bash
python -m http.server 8000
```
And open `http://127.0.0.1:8000`.


## Supabase Readiness

The database schema (`supabase-schema.sql`) is ready to run in Supabase. Paste project URL and anon key into `supabase-config.js` when ready to go live.

