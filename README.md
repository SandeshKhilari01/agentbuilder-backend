# Agent Builder Platform

A complete platform for building conversational AI agents with custom integrations, actions, and knowledge bases. Supports OpenAI and Google Gemini LLMs out of the box.

## Features

###  Agent Configuration
-Demo : https://agentbuilder-frontend.vercel.app

###  Agent Configuration
- Create AI agents with custom system prompts
- Support for OpenAI (GPT-4, GPT-3.5) and Google Gemini (1.5 Pro/Flash)
- Encrypted API key storage
- Knowledge base upload (PDF, DOCX, TXT, CSV)
- Vector embeddings with semantic search
- Monaco editor for prompt editing

###  Integration Builder (REST API)
- Visual REST API integration builder
- Support for GET, POST, PUT, DELETE methods
- Flexible authentication (Header, Query, Bearer, Basic)
- Path parameter templating with `{variable}` syntax
- Test panel with request/response viewer
- Secret management with encryption

###  Action Builder
- Create actions that combine integrations with LLM workflows
- Dynamic variable builder with type validation
- Mustache-style template injection (`{{variable}}`)
- Execution modes: ON_CALL (explicit) and POST_CALL (automatic)
- Test runner with sample inputs
- Save and reuse test cases

## Architecture

```
agent-builder-platform/
├── backend/          # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── services/       # Business logic
│   │   │   ├── llm/       # LLM wrapper (OpenAI + Gemini)
│   │   │   ├── embeddings/ # Vector DB & KB processing
│   │   │   ├── actions/    # Action executor
│   │   │   └── integrations/
│   │   ├── routes/        # API routes
│   │   └── server.ts
│   └── prisma/
│       └── schema.prisma  # Database schema
├── frontend/         # React + Vite + TypeScript
│   └── src/
│       ├── pages/         # Main UI pages
│       ├── components/    # Reusable components
│       └── services/      # API client
└── docker-compose.yml
```

## Tech Stack

**Backend:**
- Node.js 20 + Express
- TypeScript
- Prisma ORM + PostgreSQL
- OpenAI SDK
- Google Generative AI SDK
- Pinecone (Vector DB)
- AES-256-GCM encryption

**Frontend:**
- React 18
- Vite
- TypeScript
- Tailwind CSS
- Monaco Editor
- Axios

## Quick Start

### Prerequisites

- **Node.js 20+** (required)
- **PostgreSQL 14+** (required - local or Docker)
- **Gemini or OpenAI API Key** (optional - uses mock embeddings without it)

---

## Setup Instructions

### 1. Database Setup

Choose **Option A** (Local PostgreSQL) or **Option B** (Docker):

#### Option A: Local PostgreSQL (Recommended)

```bash
# Check if PostgreSQL is running
pg_isready

# If not running, start it (macOS with Homebrew)
brew services start postgresql@14

# Create database
createdb agentbuilder
```

Update `backend/.env`:
```env
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/agentbuilder"
```

#### Option B: Docker PostgreSQL

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Check it's running
docker-compose ps
```

Update `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agentbuilder"
```

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL and ENCRYPTION_KEY

# Generate encryption key (copy output to .env)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Run database migrations
npx prisma migrate dev

# Start backend server
npm run dev
```

**Backend will start on:** http://localhost:3000

---

### 3. Frontend Setup

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Start frontend dev server
npm run dev
```

**Frontend will start on:** http://localhost:5173

---

### 4. Access the Application

- **Frontend UI:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **Database Studio:** `npx prisma studio` (in backend directory)

---

### 5. Optional Configuration

Edit `backend/.env` to add API keys:

```env
# For LLM functionality (at least one required)
GEMINI_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="sk-your-openai-key"

# For persistent vector storage (optional - uses PostgreSQL by default)
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_INDEX_NAME="agent-kb"
```

**Note:** Without API keys, the system uses mock embeddings for development/testing.

## Database Setup

The Prisma schema includes:
- **Agent** - Agent configurations
- **Integration** - REST API definitions
- **Action** - Action definitions
- **KnowledgeBase** - Uploaded files
- **VectorChunk** - Embedded text chunks
- **Secret** - Encrypted secrets
- **TestCase** - Saved test cases

**Run migrations:**
```bash
cd backend
npm run migrate
```

**Reset database:**
```bash
npx prisma migrate reset
```

## End-to-End Demo

### Step 1: Create an Integration

1. Navigate to **Integrations** page
2. Click **New Integration**
3. Fill in the form:
   - **Name:** `get_user`
   - **Description:** `Fetch user by ID`
   - **Method:** `GET`
   - **URL:** `https://jsonplaceholder.typicode.com/users/{user_id}`
   - **Auth:** Disabled (public API)
4. Click **Create Integration**
5. Click **Test** to verify (use any user_id like 1, 2, 3)

### Step 2: Create an Action

1. Navigate to **Actions** page
2. Click **New Action**
3. Fill in the form:
   - **Name:** `getUserInfo`
   - **Description for LLM:** `Use this action to fetch user information by user ID`
   - **Integration:** Select `get_user`
   - **Execution Mode:** `ON_CALL`
4. Add a variable:
   - **Name:** `user_id`
   - **Type:** `number`
   - **Description:** `The user ID to fetch`
5. Leave **Body Template** empty (GET request)
6. Click **Create Action**
7. Test the action:
   - Enter `user_id`: `1`
   - Click **Execute Test**
   - Verify response shows user data

### Step 3: Create an Agent

1. Navigate to **Agents** page
2. Click **New Agent**
3. Fill in the form:
   - **Name:** `User Info Assistant`
   - **System Prompt:**
     ```
     You are a helpful assistant that can fetch user information.
     When asked about a user, use the getUserInfo action.
     ```
   - **LLM Provider:** `OpenAI`
   - **Model:** `gpt-4`
   - **API Key:** Your OpenAI API key
4. Click **Create Agent**

### Step 4: Add Action to Agent

```bash
# Using API (or add UI button)
curl -X POST http://localhost:3000/api/agents/{agent_id}/actions \
  -H "Content-Type: application/json" \
  -d '{"actionId": "{action_id}"}'
```

### Step 5: Chat with Agent

```bash
curl -X POST http://localhost:3000/api/agents/{agent_id}/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Get me information about user 5"}
    ]
  }'
```

**Expected Flow:**
1. LLM receives message and available actions
2. LLM outputs tool call JSON:
   ```json
   {"tool": "getUserInfo", "inputs": {"user_id": 5}}
   ```
3. Platform executes action → calls integration
4. Returns action result to LLM
5. LLM uses result to formulate response

### Step 6: Test Knowledge Base (Optional)

1. Select your agent
2. Upload a PDF/TXT file
3. Wait for processing (status changes to "indexed")
4. Use the search box to test retrieval
5. Results show relevant chunks with similarity scores

## API Endpoints

### Agents
- `POST /api/agents` - Create agent
- `GET /api/agents` - List agents
- `GET /api/agents/:id` - Get agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/chat` - Chat with agent
- `POST /api/agents/:id/actions` - Add action to agent

### Integrations
- `POST /api/integrations` - Create integration
- `GET /api/integrations` - List integrations
- `GET /api/integrations/:id` - Get integration
- `PUT /api/integrations/:id` - Update integration
- `DELETE /api/integrations/:id` - Delete integration
- `POST /api/integrations/:id/test` - Test integration

### Actions
- `POST /api/actions` - Create action
- `GET /api/actions` - List actions
- `GET /api/actions/:id` - Get action
- `PUT /api/actions/:id` - Update action
- `DELETE /api/actions/:id` - Delete action
- `POST /api/actions/:id/test` - Test action
- `POST /api/actions/:id/execute` - Execute action

### Knowledge Base
- `POST /api/kb/upload` - Upload file
- `GET /api/kb/agent/:agentId` - List KB files
- `POST /api/kb/build-embeddings` - Build embeddings
- `POST /api/kb/search` - Search KB
- `DELETE /api/kb/:id` - Delete KB file

## Security

### Encryption
- All API keys encrypted with AES-256-GCM
- 32-byte encryption key from environment
- Random IV per encryption
- Secrets masked in UI and logs

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable per endpoint

### Best Practices
- Never commit `.env` files
- Rotate encryption keys periodically
- Use HTTPS in production
- Implement user authentication (not included in MVP)

## Development

### Run Tests
```bash
cd backend
npm test
```

### Generate Prisma Client
```bash
cd backend
npm run generate
```

### View Database
```bash
cd backend
npm run studio
```

### Build for Production
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Run migrations: `npm run migrate`

### Encryption Error
- Verify `ENCRYPTION_KEY` is 64-character hex string
- Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Vector DB Error
- Pinecone is optional for MVP
- Set `PINECONE_API_KEY` if using KB features
- Create index with dimension 1536 (OpenAI) or 768 (Gemini)

### File Upload Error
- Check `uploads/` directory exists and is writable
- Verify file size < 10 MB
- Supported types: PDF, DOCX, TXT, CSV

## Scaling Considerations

### Horizontal Scaling
- Backend is stateless → use load balancer
- Session storage in Redis (if adding auth)
- File uploads to S3/GCS

### Queue System
- Add Bull/BeeQueue for KB processing
- Background job workers for embeddings
- Webhook callbacks for long-running actions

### Caching
- Redis for LLM responses
- Cache embeddings to reduce API calls
- CDN for frontend assets

### Monitoring
- Add logging (Winston/Pino)
- Metrics (Prometheus)
- Error tracking (Sentry)
- Cost tracking for LLM usage

## License

MIT

## Support

For issues or questions, please open a GitHub issue.

---

**Built with ❤️ using Node.js, React, and AI**
