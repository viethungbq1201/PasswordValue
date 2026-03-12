# SecureVault — Zero-Knowledge Password Manager

> **Your vault data is encrypted entirely on your device. The server stores only encrypted binary blobs and can never access your passwords, notes, or card numbers.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Folder Structure](#4-project-folder-structure)
5. [Backend Explanation](#5-backend-explanation)
6. [Frontend Explanation](#6-frontend-explanation)
7. [Browser Extension Explanation](#7-browser-extension-explanation)
8. [Database Structure](#8-database-structure)
9. [Installation Guide](#9-installation-guide)
10. [Running the Project](#10-running-the-project)
11. [End-to-End Workflow](#11-end-to-end-workflow)
12. [Troubleshooting](#12-troubleshooting)
13. [Development Guide](#13-development-guide)
14. [Deployment Guide](#14-deployment-guide)

---

## 1. Project Overview

### What Is SecureVault?

SecureVault is a **self-hosted, full-stack password manager** with a zero-knowledge security architecture. It allows users to:

- **Store credentials** (logins, credit cards, secure notes, identities, OTP secrets)
- **Organize** items with folders and favorites
- **Search** the vault instantly
- **Generate** cryptographically strong passwords
- **Autofill** credentials in browser login forms
- **Sync** across multiple devices
- **Soft-delete** and restore items from a recycle bin

### What Problem Does It Solve?

Commercial password managers (LastPass, Bitwarden, 1Password) require trusting a third-party cloud. SecureVault gives users **complete control** over their data by self-hosting the backend, while ensuring that even the server admin cannot read vault contents — the encryption key is derived from the user's master password and **never leaves the client**.

### Security Model

| Concept | Implementation |
|---------|---------------|
| Key Derivation | **Argon2id** — 64 MB memory, 3 iterations, 32-byte output |
| Vault Encryption | **AES-256-GCM** — authenticated encryption with random nonces |
| Server-Side Auth | **Argon2** password hashing via `Argon2PasswordEncoder` |
| API Auth | **JWT** (HMAC-SHA256), stateless, configurable expiry |
| Transport | **HTTPS** (TLS in production) |
| Storage | Encrypted data stored as **BYTEA** (binary) in PostgreSQL |

**Encryption flow:**

```
User's Master Password
        │
        ▼
  Argon2id(password, email_as_salt)
        │
        ▼
  256-bit Master Key (client memory only — never transmitted)
        │
        ▼
  AES-256-GCM(key, random_nonce) ──▶ Encrypted BYTEA blob
        │
        ▼
  Upload to server (server CANNOT decrypt)
```

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT APPS                            │
│                                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ React Web  │  │ Flutter    │  │ Chrome Browser         │  │
│  │ Frontend   │  │ Mobile/    │  │ Extension              │  │
│  │ (Vite +    │  │ Desktop    │  │ (Manifest V3)          │  │
│  │ Tailwind)  │  │ App        │  │                        │  │
│  │ :5173      │  │            │  │ popup.html / popup.js  │  │
│  └─────┬──────┘  └─────┬──────┘  │ content.js / bg.js    │  │
│        │               │         └──────────┬─────────────┘  │
│        │               │                    │                 │
│        └───────────────┼────────────────────┘                 │
│                        │                                       │
│         All clients encrypt/decrypt locally                    │
│         using AES-256-GCM + Argon2id                          │
│         Only encrypted BYTEA blobs are sent                    │
└────────────────────────┼───────────────────────────────────────┘
                         │
                    HTTPS / REST API
                         │
┌────────────────────────▼───────────────────────────────────────┐
│                   BACKEND (Spring Boot 3.4.3)                  │
│                       :8080                                    │
│                                                                │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐              │
│  │ AuthService   │  │VaultService│  │FolderSvc │              │
│  │ (JWT + Argon2 │  │(CRUD,fav,  │  │(CRUD,    │              │
│  │  register/    │  │ trash,     │  │ soft     │              │
│  │  login)       │  │ restore)   │  │ delete)  │              │
│  └──────────────┘  └────────────┘  └──────────┘              │
│  ┌──────────────┐  ┌────────────────────────────┐             │
│  │ SyncService  │  │ SecurityConfig             │             │
│  │ (multi-device│  │ (CORS, JWT filter,         │             │
│  │  delta sync) │  │  Argon2PasswordEncoder)    │             │
│  └──────────────┘  └────────────────────────────┘             │
│                                                                │
│  Flyway manages schema migrations automatically               │
└────────────────────────┬───────────────────────────────────────┘
                         │
                    JDBC (PostgreSQL driver)
                         │
┌────────────────────────▼───────────────────────────────────────┐
│                    PostgreSQL 16                               │
│                       :5432                                    │
│                                                                │
│  Tables: users, devices, folders, vault_items                  │
│  vault_items.encrypted_data = BYTEA (binary, NOT readable)     │
│                                                                │
│  Docker volume: pgdata (persistent)                            │
└────────────────────────────────────────────────────────────────┘
```

### Component Interactions

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| React Frontend | Backend API | HTTP (`/api/*`) via Vite proxy | Auth, vault CRUD, folders |
| Flutter App | Backend API | HTTP (direct) | Same API endpoints |
| Browser Extension | Backend API | HTTP (fetch) | Login, vault list, sync |
| Browser Extension | Web Page | DOM injection (content script) | Autofill login forms |
| Backend | PostgreSQL | JDBC | Read/write encrypted data |
| Backend | Flyway | Startup | Auto-run schema migrations |

---

## 3. Technology Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Java | 21 | Runtime |
| Spring Boot | 3.4.3 | Web framework |
| Spring Security | 6.x | Authentication, CORS, filters |
| Spring Data JPA | — | ORM / database access |
| PostgreSQL | 16 | Database |
| Flyway | 10.x | Schema migration |
| JJWT | 0.12.5 | JWT creation/validation |
| Argon2 (de.mkammerer) | 2.11 | Password hashing |
| Maven | — | Build tool |
| Docker | — | Containerization |

### Frontend (Web)

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3 | UI framework |
| Vite | 5.4 | Build tool + dev server |
| TailwindCSS | 3.4 | Utility-first CSS |
| React Router | 6.22 | Client-side routing |
| Axios | 1.6 | HTTP client with interceptors |

### Frontend (Mobile/Desktop)

| Technology | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.2+ | Cross-platform UI |
| Provider | 6.1 | State management |
| flutter_secure_storage | 9.0 | Encrypted local storage |
| cryptography (dart) | 2.7 | AES-256-GCM + Argon2id |

### Browser Extension

| Technology | Version | Purpose |
|-----------|---------|---------|
| Chrome Manifest | V3 | Extension configuration |
| JavaScript (ES6+) | — | Popup, content script, background |
| HTML/CSS | — | Popup UI |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker | Container runtime |
| Docker Compose | Multi-service orchestration |

---

## 4. Project Folder Structure

```
securevault/
│
├── password/                        ← BACKEND (Spring Boot)
│   ├── pom.xml                      ← Maven dependencies
│   ├── Dockerfile                   ← Multi-stage Docker build
│   └── src/
│       ├── main/
│       │   ├── java/com/securevault/
│       │   │   ├── SecureVaultApplication.java     ← Entry point
│       │   │   ├── core/                            ← DOMAIN LAYER
│       │   │   │   ├── domain/                      ← JPA entities
│       │   │   │   │   ├── User.java                ← id, email, password_hash
│       │   │   │   │   ├── Device.java              ← id, user_id, device_name, last_sync
│       │   │   │   │   ├── VaultItem.java           ← id, type, encrypted_data (BYTEA),
│       │   │   │   │   │                                favorite, deleted_at
│       │   │   │   │   └── Folder.java              ← id, user_id, name, deleted_at
│       │   │   │   ├── enums/
│       │   │   │   │   ├── VaultItemType.java       ← LOGIN, CARD, SECURE_NOTE, IDENTITY, OTP
│       │   │   │   │   └── DeviceType.java          ← BROWSER, DESKTOP, MOBILE
│       │   │   │   └── repository/                  ← Spring Data JPA repositories
│       │   │   │       ├── UserRepository.java
│       │   │   │       ├── VaultItemRepository.java ← custom queries for favorites,
│       │   │   │       │                                trash, type filter, delta sync
│       │   │   │       ├── FolderRepository.java
│       │   │   │       └── DeviceRepository.java
│       │   │   ├── infrastructure/                  ← CROSS-CUTTING
│       │   │   │   ├── config/
│       │   │   │   │   └── SecurityConfig.java      ← CORS, JWT filter chain,
│       │   │   │   │                                    Argon2PasswordEncoder bean,
│       │   │   │   │                                    public vs protected endpoints
│       │   │   │   ├── security/
│       │   │   │   │   ├── JwtUtil.java             ← generate/validate JWT tokens
│       │   │   │   │   ├── JwtAuthenticationFilter.java ← extract JWT from Authorization header
│       │   │   │   │   └── UserDetailsServiceImpl.java
│       │   │   │   └── exception/
│       │   │   │       └── GlobalExceptionHandler.java ← validation + auth error responses
│       │   │   └── api/                             ← REST LAYER
│       │   │       ├── controller/
│       │   │       │   ├── AuthController.java      ← POST /auth/register, /auth/login
│       │   │       │   ├── VaultController.java     ← CRUD + favorites + trash + restore
│       │   │       │   ├── FolderController.java    ← CRUD + soft delete
│       │   │       │   ├── SyncController.java      ← upload, delta download, full download
│       │   │       │   └── HealthController.java    ← GET /health
│       │   │       ├── dto/                         ← Request/Response objects
│       │   │       │   ├── auth/   (AuthRequest, AuthResponse, RegisterRequest)
│       │   │       │   ├── vault/  (VaultItemRequest, VaultItemResponse)
│       │   │       │   ├── folder/ (FolderRequest, FolderResponse)
│       │   │       │   └── sync/   (SyncRequest, SyncResponse)
│       │   │       └── service/
│       │   │           ├── AuthService.java         ← Argon2 register/login + JWT generation
│       │   │           ├── VaultService.java        ← item CRUD with ownership checks
│       │   │           ├── FolderService.java       ← folder CRUD with soft delete
│       │   │           └── SyncService.java         ← multi-device sync logic
│       │   └── resources/
│       │       ├── application.yaml                 ← DB, JWT, Flyway config
│       │       └── db/migration/
│       │           └── V1__init_schema.sql          ← Flyway: tables, indexes, constraints
│       └── test/
│           └── java/com/securevault/
│               └── SecureVaultApplicationTests.java
│
├── frontend_web/                    ← WEB FRONTEND (React + Vite + TailwindCSS)
│   ├── package.json                 ← dependencies
│   ├── vite.config.js               ← dev server + API proxy to :8080
│   ├── tailwind.config.js           ← custom SecureVault theme colors
│   ├── postcss.config.js
│   ├── index.html                   ← entry HTML with Inter font
│   └── src/
│       ├── main.jsx                 ← React root + Router + AuthProvider
│       ├── App.jsx                  ← Route definitions + PrivateRoute guard
│       ├── index.css                ← Tailwind + custom component classes
│       ├── services/
│       │   ├── api.js               ← Axios instance + JWT interceptor +
│       │   │                            all API methods (auth, vault, folders, sync)
│       │   └── AuthContext.jsx      ← React Context for login/logout/register
│       ├── pages/
│       │   ├── LoginPage.jsx        ← email + master password form
│       │   ├── RegisterPage.jsx     ← registration with 12-char minimum
│       │   ├── DashboardPage.jsx    ← sidebar + search + vault list + CRUD
│       │   └── SettingsPage.jsx     ← account, security, sync, about
│       └── components/
│           ├── VaultItemModal.jsx   ← add/edit modal with type-specific fields
│           └── PasswordGenerator.jsx ← length slider, char toggles, strength meter
│
├── browser_extension/               ← CHROME EXTENSION (Manifest V3)
│   ├── manifest.json                ← ⚠️ MUST be at root of this folder
│   ├── popup.html                   ← extension popup UI
│   ├── popup.js                     ← login, vault list, search, autofill trigger
│   ├── content.js                   ← injected into all pages: form detection, autofill
│   ├── background.js                ← service worker: badge management
│   ├── styles.css                   ← popup dark theme
│   ├── content-styles.css           ← injected page styles (minimal)
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── frontend_flutter/                ← FLUTTER APP (Mobile + Desktop)
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart
│       ├── models/                  ← VaultItem, Folder
│       ├── services/                ← CryptoService, AuthService, VaultService
│       ├── screens/                 ← Login, Register, Dashboard, AddItem, Detail, Settings
│       ├── widgets/                 ← PasswordGenerator
│       └── utils/                   ← Theme, Constants
│
├── docker-compose.yml               ← PostgreSQL + Backend containers
└── README.md                        ← This file
```

---

## 5. Backend Explanation

### How the Backend Works

The backend is a **Spring Boot 3.4.3** REST API that serves as the **encrypted data storage layer**. It never decrypts vault data — it simply stores and retrieves encrypted binary blobs.

### Authentication Flow

1. **Registration** (`POST /api/auth/register`):
   - Receives `email` and `masterPassword`
   - Hashes the master password using `Argon2PasswordEncoder` (server-side hash for authentication only)
   - Creates a `User` record in PostgreSQL
   - Returns a JWT token

2. **Login** (`POST /api/auth/login`):
   - Receives `email` and `masterPassword`
   - Verifies password hash using Argon2
   - Returns a JWT token

3. **JWT Token**:
   - Generated by `JwtUtil.java` using HMAC-SHA with configured secret
   - Contains `userId` as subject, `email` as claim
   - Expiry: 24 hours (configurable via `JWT_SECRET` env var)
   - Attached to requests as `Authorization: Bearer <token>`

4. **Request Authentication**:
   - `JwtAuthenticationFilter` intercepts every request
   - Extracts and validates the JWT from the `Authorization` header
   - Sets `userId` as the `Authentication.principal`
   - Controllers access the user via `(UUID) auth.getPrincipal()`

### API Endpoints

#### Authentication (Public — no token required)

```
POST /api/auth/register
  Body: { "email": "user@example.com", "masterPassword": "strongPassword123!" }
  Response: { "token": "eyJ...", "userId": "uuid", "email": "user@example.com" }

POST /api/auth/login
  Body: { "email": "user@example.com", "masterPassword": "strongPassword123!" }
  Response: { "token": "eyJ...", "userId": "uuid", "email": "user@example.com" }

GET /api/health
  Response: { "status": "UP", "service": "SecureVault", "timestamp": "..." }
```

#### Vault Items (Requires Bearer token)

```
GET    /api/vault                    ← All active items for this user
GET    /api/vault?type=LOGIN         ← Filter by type (LOGIN, CARD, SECURE_NOTE, IDENTITY, OTP)
GET    /api/vault/favorites          ← Items where favorite = true
GET    /api/vault/trash              ← Items where deleted_at IS NOT NULL
GET    /api/vault/folder/{folderId}  ← Items in a specific folder

POST   /api/vault                    ← Create item
  Body: { "type": "LOGIN", "encryptedData": <BYTEA>, "favorite": false, "folderId": null }

PUT    /api/vault/{id}               ← Update item
  Body: { "type": "LOGIN", "encryptedData": <BYTEA>, "favorite": true }

DELETE /api/vault/{id}               ← Soft delete (sets deleted_at). Item moves to trash.
POST   /api/vault/{id}/restore       ← Restore from trash (clears deleted_at)
DELETE /api/vault/{id}/permanent     ← Permanent delete (removes from database)
```

#### Folders (Requires Bearer token)

```
GET    /api/folders         ← All active folders
POST   /api/folders         ← Create folder   Body: { "name": "Work" }
PUT    /api/folders/{id}    ← Rename folder    Body: { "name": "Personal" }
DELETE /api/folders/{id}    ← Soft delete folder
```

#### Sync (Requires Bearer token)

```
POST /api/sync/upload              ← Upload encrypted items from a device
  Body: { "deviceName": "Chrome", "deviceType": "BROWSER", "items": [...] }

GET  /api/sync/download?since=...  ← Delta sync: items modified since timestamp
POST /api/sync/full                ← Full vault download (for new device setup)
```

### CORS Configuration

The backend allows requests from these origins:

| Origin | Purpose |
|--------|---------|
| `http://localhost:5173` | React dev server |
| `http://localhost:*` | Any local development |
| `chrome-extension://*` | Browser extension |
| `https://*.onrender.com` | Production deployment |

Configured in `SecurityConfig.java`.

---

## 6. Frontend Explanation

### How the Web Frontend Works

The web frontend is a **React SPA** built with **Vite** and **TailwindCSS**. It runs on port `5173` in development and proxies `/api/*` requests to the backend at port `8080`.

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| LoginPage | `/login` | Email + master password login |
| RegisterPage | `/register` | Account creation (12-char password minimum) |
| DashboardPage | `/` (default) | Sidebar navigation + vault list + add/edit/delete items |
| SettingsPage | `/settings` | Account info, security, sync status, logout |

### Key Files

| File | Purpose |
|------|---------|
| `src/services/api.js` | Axios instance with JWT interceptor. Attaches `Authorization: Bearer <token>` to every request. Auto-logout on 401. Contains typed API methods for auth, vault, folders, sync. |
| `src/services/AuthContext.jsx` | React Context providing `{ user, login, register, logout }`. Persists JWT in `localStorage`. |
| `src/components/VaultItemModal.jsx` | Modal for adding/editing vault items. Supports all 5 types (LOGIN, CARD, SECURE_NOTE, IDENTITY, OTP) with type-specific form fields. |
| `src/components/PasswordGenerator.jsx` | Cryptographic password generator with configurable length, character types, and strength indicator. Uses `crypto.getRandomValues()`. |

### API Integration Pattern

```javascript
// api.js — Axios interceptor attaches JWT automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sv_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Usage in components:
import { vaultApi } from '../services/api'
const res = await vaultApi.getAll()      // GET /api/vault
const res = await vaultApi.create(data)  // POST /api/vault
```

### Running the Frontend

```bash
cd frontend_web
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build to dist/
```

---

## 7. Browser Extension Explanation

### How the Chrome Extension Works

The extension is a **Chrome Manifest V3** extension with three components:

#### 1. Popup (`popup.html` + `popup.js`)

The popup is the main UI when clicking the extension icon. It has two views:

- **Login View**: Email + master password form → calls `POST /api/auth/login` → stores JWT token in `chrome.storage.local`
- **Vault View**: Shows all vault items with search → click to autofill → click 📋 to copy password

#### 2. Content Script (`content.js`)

Injected into all web pages. It:

- **Detects login forms** by looking for `<input type="password">` elements
- **Listens for autofill messages** from the popup
- **Fills credentials** into form fields using the native value setter pattern (compatible with React, Vue, Angular):

```javascript
const nativeSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype, 'value'
)?.set
nativeSetter.call(input, value)
input.dispatchEvent(new Event('input', { bubbles: true }))
```

- **Finds username fields** using a priority-ordered selector list:
  `[autocomplete="username"]` → `[name="email"]` → `[type="email"]` → `[type="text"]` → etc.

#### 3. Background Service Worker (`background.js`)

- Listens for `LOGIN_FORM_DETECTED` messages from the content script
- Shows a blue badge dot (●) on the extension icon when a login form is detected
- Cleans up state when tabs are closed or navigated

### Manifest Configuration

The `manifest.json` file:

- Must be at the **root** of the `browser_extension/` folder
- Uses `manifest_version: 3`
- Declares `permissions: ["storage", "activeTab"]`
- References only `.js` files (not `.ts` — Chrome cannot load TypeScript)
- All icon files must exist at the referenced paths

### Installing the Extension

```
1. Open chrome://extensions
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the browser_extension/ folder
5. The SecureVault icon appears in the toolbar
```

### Why the Extension Previously Failed

The original extension failed to load because:

1. `manifest.json` was inside `public/` subfolder — Chrome requires it at the **root**
2. Manifest referenced `.ts` TypeScript files — Chrome can only load `.js`
3. Icon files did not exist — Chrome requires all referenced icons to be present
4. The project required a build step (Vite) — Chrome needs ready-to-load files

These issues have been fixed by restructuring the extension with plain JavaScript files and placing `manifest.json` at the root.

---

## 8. Database Structure

### Schema (managed by Flyway: `V1__init_schema.sql`)

#### `users` Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL (Argon2 hash) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

#### `devices` Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users(id) |
| device_name | VARCHAR(255) | NOT NULL |
| device_type | VARCHAR(50) | BROWSER, DESKTOP, MOBILE |
| last_sync_at | TIMESTAMP | |

#### `folders` Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users(id) |
| name | VARCHAR(255) | NOT NULL |
| deleted_at | TIMESTAMP | NULL = active, set = soft-deleted |

#### `vault_items` Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users(id) |
| folder_id | UUID | FOREIGN KEY → folders(id), NULLABLE |
| type | VARCHAR(50) | LOGIN, CARD, SECURE_NOTE, IDENTITY, OTP |
| **encrypted_data** | **BYTEA** | **Encrypted binary blob — server cannot read** |
| favorite | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | |
| **deleted_at** | **TIMESTAMP** | **NULL = active, set = in trash (soft delete)** |

#### Indexes

```sql
CREATE INDEX idx_vault_items_user_id ON vault_items(user_id);
CREATE INDEX idx_vault_items_type ON vault_items(type);
CREATE INDEX idx_vault_items_folder_id ON vault_items(folder_id);
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_devices_user_id ON devices(user_id);
```

### Entity Relationships

```
users (1) ──── (N) vault_items
users (1) ──── (N) folders
users (1) ──── (N) devices
folders (1) ── (N) vault_items
```

---

## 9. Installation Guide

### Prerequisites

| Tool | Version | Install Command |
|------|---------|----------------|
| **Docker** + Docker Compose | 20+ | https://docs.docker.com/get-docker/ |
| **Java JDK** | 21+ | `brew install openjdk@21` (macOS) |
| **Node.js** + npm | 18+ | `brew install node` (macOS) |
| **Maven** | 3.9+ | Included via `mvnw` wrapper |
| **PostgreSQL** | 16+ | Via Docker (recommended) or `brew install postgresql@16` |
| **Flutter** (optional) | 3.2+ | https://docs.flutter.dev/get-started/install |
| **Google Chrome** | Latest | For browser extension |

### Clone the Repository

```bash
git clone <repository-url>
cd PasswordValue
```

---

## 10. Running the Project

### Option A: Docker Compose (Recommended)

This starts both PostgreSQL and the backend:

```bash
docker compose up -d
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Health check | http://localhost:8080/api/health |

To stop:

```bash
docker compose down           # stop containers
docker compose down -v        # stop + delete data volume
```

### Option B: Run Each Component Manually

#### Step 1: Start PostgreSQL

```bash
docker run -d \
  --name securevault-db \
  -e POSTGRES_DB=securevault \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

#### Step 2: Start Backend

```bash
cd password

# Set environment variables
export DATABASE_URL=jdbc:postgresql://localhost:5432/securevault
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
export JWT_SECRET=YourSecretKeyThatIsSuperLongAndSecureAtLeast256Bits!

# Run
./mvnw spring-boot:run
```

Backend is ready when you see: `Started SecureVaultApplication`.

Verify: `curl http://localhost:8080/api/health`

#### Step 3: Start Web Frontend

```bash
cd frontend_web
npm install
npm run dev
```

Open: http://localhost:5173

The Vite dev server proxies `/api/*` requests to `localhost:8080` automatically.

#### Step 4: Install Browser Extension

```
1. Open Google Chrome
2. Navigate to: chrome://extensions
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the browser_extension/ folder
6. SecureVault icon appears in the Chrome toolbar
```

#### Step 5: Start Flutter App (Optional)

```bash
cd frontend_flutter
flutter pub get
flutter run              # mobile emulator or connected device
flutter run -d chrome    # web browser
flutter run -d macos     # macOS desktop
```

---

## 11. End-to-End Workflow

### Complete User Journey

#### 1. User Opens Web Frontend

User navigates to `http://localhost:5173`. Since no JWT token exists in `localStorage`, they are redirected to `/login`.

#### 2. User Registers

- User clicks "Create account" → navigates to `/register`
- Fills in email and master password (minimum 12 characters)
- Frontend sends `POST /api/auth/register` with `{ email, masterPassword }`
- Backend hashes password with Argon2, creates `User` in PostgreSQL, generates JWT
- Frontend stores JWT in `localStorage` and sets `AuthContext.user`
- User is redirected to `/` (Dashboard)

#### 3. User Adds a Vault Item

- User clicks "+ Add Item" → `VaultItemModal` opens
- Selects type (e.g., LOGIN), fills in name, website, username, password
- Clicks "Create Item"
- Frontend sends `POST /api/vault` with `{ type, encryptedData, favorite }`
- Backend stores the encrypted blob in `vault_items.encrypted_data` (BYTEA)
- Dashboard refreshes to show the new item

#### 4. User Copies a Password

- In the vault list, user hovers over an item → copy button appears
- Clicks 🔑 → password is copied to clipboard via `navigator.clipboard.writeText()`
- Toast notification: "Password copied"

#### 5. User Uses Browser Extension

- User clicks SecureVault icon in Chrome toolbar
- If not logged in, enters email + master password → `POST /api/auth/login`
- Extension stores JWT in `chrome.storage.local`
- Vault items are loaded from `GET /api/vault`
- User visits a website with a login form
- Content script detects `<input type="password">` → sends `LOGIN_FORM_DETECTED` to background
- Blue badge dot (●) appears on extension icon
- User clicks extension → sees vault items → clicks an item
- Extension sends `SECUREVAULT_AUTOFILL` message to content script
- Content script fills username and password into the form fields
- User submits the login form on the website

#### 6. User Soft-Deletes an Item

- User clicks 🗑️ on a vault item in the dashboard
- Frontend sends `DELETE /api/vault/{id}` → backend sets `deleted_at = NOW()`
- Item disappears from the main list
- Item appears in the "Trash" section (sidebar)
- User can restore it: `POST /api/vault/{id}/restore` → clears `deleted_at`

---

## 12. Troubleshooting

### Docker Issues

| Problem | Solution |
|---------|----------|
| `docker compose up` fails | Ensure Docker Desktop is running. Try `docker compose down -v` then `docker compose up -d` |
| Port 5432 already in use | Another PostgreSQL is running. Stop it: `docker stop <container>` or change the port in `docker-compose.yml` |
| Port 8080 already in use | Kill the process: `lsof -i :8080` then `kill <PID>` |

### Database Issues

| Problem | Solution |
|---------|----------|
| `Connection refused` | PostgreSQL not started. Check: `docker ps` — ensure `securevault-db` is running |
| `FATAL: database "securevault" does not exist` | Create it: `docker exec securevault-db createdb -U postgres securevault` |
| Flyway migration failed | Check `password/src/main/resources/db/migration/V1__init_schema.sql` for syntax errors. Delete volume: `docker compose down -v` and restart |

### Backend Issues

| Problem | Solution |
|---------|----------|
| `JwtUtil` errors | Ensure `JWT_SECRET` environment variable is set and is at least 32 characters |
| 401 Unauthorized | Token expired. Re-login to get a new token |
| 403 Forbidden | CORS issue — check that your origin is in `SecurityConfig.java` allowed origins |

### Browser Extension Issues

| Problem | Solution |
|---------|----------|
| "Manifest file is missing or unreadable" | Ensure you selected the `browser_extension/` folder (the one containing `manifest.json` directly), not a parent folder |
| Extension popup shows nothing | Check DevTools for errors: right-click extension icon → "Inspect popup" |
| Autofill doesn't work | The content script may not have loaded. Refresh the target page. Some sites block content scripts. |
| "Cannot connect to server" | Backend must be running at `http://localhost:8080`. Check with `curl http://localhost:8080/api/health` |

### Frontend Issues

| Problem | Solution |
|---------|----------|
| `npm run dev` fails | Run `npm install` first. Ensure Node.js 18+. |
| API calls return network error | Backend not running or CORS not configured. Check browser DevTools Network tab. |
| TailwindCSS styles not applied | Check that `postcss.config.js` and `tailwind.config.js` exist. Run `npm run dev` again. |

---

## 13. Development Guide

### Modifying the Backend

1. **Add a new API endpoint**:
   - Create a DTO in `api/dto/`
   - Add a method in the appropriate service in `api/service/`
   - Add a controller method in `api/controller/`
   - Test: `curl -X POST http://localhost:8080/api/your-endpoint -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '...'`

2. **Add a new database table**:
   - Create a new migration file: `V2__add_your_table.sql` in `src/main/resources/db/migration/`
   - Create a JPA entity in `core/domain/`
   - Create a repository in `core/repository/`
   - Flyway runs migrations automatically on startup

3. **Change CORS settings**:
   - Edit `infrastructure/config/SecurityConfig.java`
   - Modify the `corsConfigurationSource()` method

4. **Rebuild**: `./mvnw clean compile` (or `spring-boot:run` for dev)

### Modifying the Web Frontend

1. **Add a new page**:
   - Create `src/pages/YourPage.jsx`
   - Add a route in `src/App.jsx`
   - Wrap with `<PrivateRoute>` if auth is required

2. **Add a new API method**:
   - Add a method in `src/services/api.js`
   - Use it in your component: `const res = await vaultApi.yourMethod()`

3. **Change theme colors**:
   - Edit `tailwind.config.js` → `theme.extend.colors.vault`

4. **Rebuild**: `npm run dev` (auto-reloads) or `npm run build`

### Modifying the Browser Extension

1. **Edit popup UI**: Modify `popup.html` and `popup.js`
2. **Change autofill logic**: Modify `content.js` — update `findUsernameField()` selectors
3. **Reload extension**: Go to `chrome://extensions` → click 🔄 refresh on SecureVault

---

## 14. Deployment Guide

### Deploy with Docker

1. Build and push the Docker image:

```bash
cd password
docker build -t securevault-api .
docker tag securevault-api your-registry.com/securevault-api:latest
docker push your-registry.com/securevault-api:latest
```

2. Deploy `docker-compose.yml` to your server with production environment variables:

```yaml
environment:
  DATABASE_URL: jdbc:postgresql://postgres:5432/securevault
  DB_USERNAME: <production-user>
  DB_PASSWORD: <strong-production-password>
  JWT_SECRET: <random-256-bit-secret>
  SERVER_PORT: 8080
```

### Deploy to Render

1. **Create a PostgreSQL database** on Render
2. **Create a Web Service** → connect your Git repository
3. **Root directory**: `password`
4. **Build command**: `./mvnw clean package -DskipTests`
5. **Start command**: `java -jar target/*.jar`
6. **Environment variables**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `jdbc:postgresql://<host>:5432/<db>` |
| `DB_USERNAME` | From Render DB dashboard |
| `DB_PASSWORD` | From Render DB dashboard |
| `JWT_SECRET` | Generate: `openssl rand -base64 32` |
| `SERVER_PORT` | `8080` |

### Deploy Frontend

Build the production bundle, then serve with any static host (Vercel, Netlify, Nginx):

```bash
cd frontend_web
npm run build    # outputs to dist/
```

For production, update the API base URL in `vite.config.js` or set the `VITE_API_URL` environment variable.

### Deploy Browser Extension

For public distribution:

1. Build: ensure all files are in `browser_extension/`
2. Zip the folder: `zip -r securevault-extension.zip browser_extension/`
3. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

For private use: load as unpacked extension (see section 10, step 4).

---

## License

Private — Personal use only.
