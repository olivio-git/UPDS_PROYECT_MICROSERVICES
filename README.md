# CBA Evaluation Platform

AI-powered English language assessment platform for the Bolivian-American Center (CBA) Tarija. Evaluates the four MCER skills (Reading, Writing, Listening, Speaking) with automated AI grading via GROQ and Whisper.

Built as the final thesis project for Universidad Privada Domingo Savio (UPDS).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React + Vite (Frontend)               │
└────────────────────────┬────────────────────────────────┘
                         │
                    Nginx (Gateway)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   auth-service   exam-service    user-management
   (JWT + OTP)   (exams, sessions  (candidates,
                  questions, AI     roles, audit)
                  grading)
        │                │                │
        └────────────────┼────────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
           Kafka      MongoDB     Redis
        (events)    (main DB)   (cache/OTP)
              │
     notifications-service
      (email via Resend)
              │
       grading-service
      (GROQ AI + Whisper)
```

---

## Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Table |
| Backend | Node.js, Express, TypeScript |
| AI Grading | GROQ (llama-3.3-70b), Whisper (speech-to-text) |
| Database | MongoDB, Redis |
| Messaging | Apache Kafka |
| Storage | MinIO (S3-compatible) |
| Infrastructure | Docker Compose, Nginx |
| Email | Resend |

---

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React SPA |
| auth-service | 3000 | JWT authentication + OTP via email |
| notifications-service | 3001 | Email notifications (Kafka consumer) |
| user-management-service | 3002 | Users, candidates, roles, audit logs |
| exam-service | 3003 | Exams, questions, sessions, results, reports |
| session-manager-service | 3004 | Real-time session state |
| grading-service | 3007 | AI grading (GROQ + Whisper) |

---

## Key Features

- **Multimodal exams** — multiple choice, fill-in-the-blank, essay, audio recording
- **AI grading** — automated evaluation of written and spoken responses via GROQ
- **Real-time proctoring** — live session monitoring panel for administrators
- **OTP authentication** — passwordless login via email code
- **PDF reports** — auto-generated result reports sent by email after grading
- **Audit logs** — full traceability of admin actions across all services
- **Session scheduler** — auto-start/end sessions based on configured schedule
- **Browser lockdown** — optional soft lockdown mode during exams

---

## Quick Start

**Requirements:** Docker, Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/olivio-git/UPDS_PROYECT_MICROSERVICES.git
cd UPDS_PROYECT_MICROSERVICES

# 2. Set up environment variables
cp .env.template .env
# Edit .env with your values (MongoDB, Redis, GROQ API key, Resend API key)

# 3. Start all services
docker-compose up --build -d

# 4. Open the app
# http://localhost:5173
```

---

## Environment Variables

See [`.env.template`](.env.template) for the full list. Key values:

```env
GROQ_API_KEY=           # GROQ cloud API key (for AI grading)
RESEND_API_KEY=         # Resend API key (for email)
JWT_SECRET=             # Secret for signing JWT tokens
MONGO_ROOT_USERNAME=    # MongoDB root user
MONGO_ROOT_PASSWORD=    # MongoDB root password
```

---

## Project Structure

```
├── auth-service/            # Authentication (JWT, OTP, password reset)
├── user-management-service/ # Users, candidates, roles, audit logs
├── exam-service/            # Exams, questions, sessions, results, reports
├── notifications-service/   # Email notifications via Kafka events
├── mcp-grading-server/      # AI grading service (GROQ + Whisper)
├── session-manager-service/ # Session real-time state management
├── frontend/                # React SPA
├── nginx/                   # API gateway config
├── docker-compose.yml       # Full stack orchestration
└── .env.template            # Environment variables template
```

---

> Developed by [Olivio Subelza](https://github.com/olivio-git) — UPDS 2025
