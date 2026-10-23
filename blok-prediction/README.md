# BLOK OPEN XXL — Competition Predictions & Scoring App

A sleek, mobile-first web app for attendees at **Klimzaal Blok** (Hoboken, Antwerp) to predict the boulder finals champions of **BLOK OPEN XXL** (presented by **K2 × TENAYA**), guess exact IFSC final scores (Tops, Zones, Attempts), track live crowd odds, and compete on the spectator leaderboard.

---

## What's Included

- **Official Event Branding:** Matches the official competition flyer (hoodie wine palette, chalk white, dusty mauve accents, finals at 20:30).
- **Dual Category IFSC Prediction Flow:** Sequential wizard (Women's Finalist → Women's IFSC Scorecard → Men's Finalist → Men's IFSC Scorecard).
- **Live Crowd Odds:** Real-time breakdown of attendee predictions per climber with percentage bars.
- **Dual IFSC Scoring Engine:** Instant point calculation (+50 winner, +20 tops closeness, +15 zones closeness, +15 top att closeness, +10 zone att closeness, +25 full exact bonus, max 270 pts) with comprehensive tiebreakers.
- **Organizer Console:** Fast prediction locking, 12 finalists roster setup, official finals score entry with live previews, and safe data management.
- **Dual Mode (Local & Supabase):** Works out-of-the-box locally in `localStorage`, and connects seamlessly to Supabase for real-time mobile sync.

---

## Quick Start in VS Code

1. Open this folder in Visual Studio Code.
2. Open `index.html` with **Live Server**, or run:
   ```bash
   py app.py
   ```
   and visit `http://127.0.0.1:8000`.

---

## Live Mobile Deployment with Supabase

1. Create a project on [Supabase](https://supabase.com/).
2. Run `supabase-schema.sql` in the Supabase SQL Editor.
3. In Supabase **Authentication > Users**, create an organizer account (email + password).
4. Copy the user's UUID and add it to `public.admin_users`:
   ```sql
   insert into public.admin_users (user_id) values ('PASTE-ORGANIZATION-UUID-HERE');
   ```
5. Copy your project URL and `anon` public key into `supabase-config.js`.
6. Deploy to Render (live production URL: `https://blok-prediction.onrender.com`). QR code assets (`qr_code_hires.png`, `qr_code_transparent.png`) point to this production URL.

---

## File Structure

| File | Purpose |
| --- | --- |
| `index.html` | Semantic markup, sequential views (Welcome, Registration, Women/Men picks and IFSC scorecards, Success receipt, Results leaderboard), and Admin drawer. |
| `styles.css` | Blok Open XXL design system (hoodie wine `#200f19`, chalk white, dusty mauve `#c49ba7`, soft tape stickers). |
| `contact.css` | Radio pills and contact field styling. |
| `app.js` | App state, sequential wizard, IFSC validation, crowd odds calculation, dual scoring engine, and Supabase realtime. |
| `flyer.jpg` | Official flyer asset featuring the competition credentials. |
| `supabase-schema.sql` | Database schema, policies (RLS), and uniqueness constraints. |
| `supabase-config.js` | Supabase credentials (`url` and `anonKey`). |
| `app.py` | Local preview server and health check endpoint. |
