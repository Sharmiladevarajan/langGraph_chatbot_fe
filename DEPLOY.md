# Deploy: FE on Vercel, BE on Render

## Backend (Render)

1. **Push your repo** (ensure `backend/Dockerfile` and `backend/.dockerignore` are committed).

2. **Render – New Web Service**
   - Connect the repo.
   - **Root directory:** `backend` (or set **Dockerfile path** to `backend/Dockerfile` if root is repo root).
   - **Environment variables:** add all from `backend/.env` (e.g. `OPENAI_API_KEY`, `PINECONE_API_KEY`, `LLM_PROVIDER`, etc.). Do **not** commit `.env`; set them in Render dashboard.
   - Render sets `PORT` automatically; the Dockerfile uses it.
   - Deploy. Note the backend URL (e.g. `https://your-app.onrender.com`).

3. **Build/run with Docker**
   - Render will use `backend/Dockerfile` if the service root is `backend`, or set “Docker” and path to `backend/Dockerfile`.

---

## Frontend (Vercel – recommended, no Docker)

1. **Connect repo** to Vercel.
2. **Root directory:** `frontend`.
3. **Environment variable:**  
   `NEXT_PUBLIC_API_URL` = your Render backend URL (e.g. `https://your-app.onrender.com`).  
   This is used in `next.config.js` rewrites so `/api/backend/*` goes to your backend.
4. **Build command:** `npm run build` (default).  
   **Output:** Next.js (default).  
   Deploy. No Docker needed on Vercel.

---

## Frontend (Docker – e.g. Render or any container host)

If you run the frontend in a **container** (e.g. a second Render service):

1. **Build with backend URL:**
   ```bash
   cd frontend
   docker build --build-arg NEXT_PUBLIC_API_URL=https://your-backend.onrender.com -t fe .
   docker run -p 3000:3000 fe
   ```
2. **On Render:** New Web Service → Docker → Dockerfile path `frontend/Dockerfile`, and set **Environment** `NEXT_PUBLIC_API_URL` to your backend URL (build arg is optional if you set env at build time).

---

## CORS

On **Render**, set the backend env var:

- **`CORS_ORIGINS`** = your Vercel URL (e.g. `https://your-app.vercel.app`), or comma-separated list.  
  Default is `http://localhost:3000`.

---

## Summary

| App    | Where   | How |
|--------|--------|-----|
| Backend | Render | Docker (`backend/Dockerfile`), env vars in dashboard |
| Frontend | Vercel | Git connect, root `frontend`, set `NEXT_PUBLIC_API_URL` to Render URL |
| Frontend | Render (Docker) | Optional: second service using `frontend/Dockerfile`, same env var |
