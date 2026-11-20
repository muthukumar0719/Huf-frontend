# Huf-frontend

Frontend apps for AIONION HUF account onboarding (React + Vite).

- `frontend/` – RM portal: HUF application form (contact & PAN, bank, Karta & co-parceners, documents).
- `client-frontend/` – client journey from the emailed link: review, mobile/email OTP, consent, Razorpay payment, live photo, signature.

## Run

```bash
cd client-frontend   # or frontend
npm install
npm run dev
```

`client-frontend` reads the API address from `VITE_API_URL` in its `.env` (not committed).
