# BLOK OPEN XXL — Competition Predictions & Raffle App

A sleek, mobile-first web app for attendees at **Klimzaal Blok** (Hoboken, Antwerp) to predict the finals champion of **BLOK OPEN XXL** (presented by **K2 × TENAYA**), track live crowd odds, and enter the official prize raffle (exclusive merch & goodies).

---

## What's Included

- **Official Event Branding:** Matches the official competition flyer (hoodie wine palette, chalk white, dusty mauve accents, finals at 20:30).
- **Live Crowd Odds:** Real-time breakdown of attendee predictions per climber with percentage bars.
- **Admin Lucky Draw Raffle:** Instant randomized drawing from all participants who correctly guessed the champion, with contact information for the speaker/podium ceremony.
- **Contact-based Duplicate Prevention:** Allows participants with common names to enter while preventing multiple entries using the same email or phone.
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
6. Deploy the folder to GitHub Pages, Netlify, Vercel, or Render. Generate a QR code pointing to the live URL for attendees to scan at the gym!

---

## File Structure

| File | Purpose |
| --- | --- |
| `index.html` | Semantic markup, views (Welcome, Prediction, Success, Results), and Admin drawer. |
| `styles.css` | Blok Open XXL design system (hoodie wine `#200f19`, chalk white, dusty mauve `#c49ba7`, gold). |
| `contact.css` | Radio pills and contact field styling. |
| `app.js` | App state, prediction submission, crowd odds calculation, lucky draw raffle, and Supabase realtime. |
| `flyer.jpg` | Official flyer asset featuring the competition credentials. |
| `supabase-schema.sql` | Database schema, policies (RLS), and uniqueness constraints. |
| `supabase-config.js` | Supabase credentials (`url` and `anonKey`). |
| `app.py` | Local preview server and health check endpoint. |
