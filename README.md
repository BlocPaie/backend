# BlocPaie Backend

REST API for the BlocPaie invoice-to-payment platform. Handles identity management, invoice lifecycle, and on-chain transaction record keeping.

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** MongoDB (Atlas)
- **ODM:** Mongoose
- **Validation:** Zod
- **Auth:** JWT
- **Hosting:** Render

## Project Structure

```
src/
├── config/
│   └── db.ts                        # MongoDB connection
├── models/
│   ├── Company.ts
│   ├── Contractor.ts
│   ├── CompanyContractor.ts         # Company ↔ Contractor link
│   ├── Vault.ts
│   ├── AddressMapping.ts            # ERC20Vault fresh address mappings
│   └── Invoice.ts                   # Invoices with embedded transactions
├── middleware/
│   ├── auth.ts                      # JWT authentication + role guards
│   └── error.ts                     # Global error handler
├── validators/
│   ├── registry.ts                  # Zod schemas for registry routes
│   └── invoice.ts                   # Zod schemas for invoice routes
├── utils/
│   └── hash.ts                      # Invoice hash computation (keccak256)
├── routes/
│   ├── registry/
│   │   ├── companies.ts             # /api/registry/companies
│   │   ├── contractors.ts           # /api/registry/contractors
│   │   ├── vaults.ts                # /api/registry/vaults
│   │   └── addressMappings.ts       # /api/registry/address-mappings
│   └── invoices/
│       └── index.ts                 # /api/invoices
├── app.ts                           # Express app setup
└── index.ts                         # Entry point
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in the values:

```
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/blocpaie
JWT_SECRET=<generate below>
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Run in development

```bash
npm run dev
```

API will be available at `http://localhost:3000`.

### 4. Build for production

```bash
npm run build
npm start
```

## API Overview

All endpoints are prefixed with `/api`. Full documentation is in `../BACKEND_REPORT.md`.

### Authentication

Every request requires a JWT bearer token:

```
Authorization: Bearer <token>
```

JWT payload must contain `sub` (Porto Account address) and `role` (`company`, `contractor`, or `platform`).

### Route Groups

#### Registry — `/api/registry`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/companies` | platform | Register a company |
| GET | `/companies/:id` | any | Get company profile |
| GET | `/companies/:id/vaults` | company, platform | List company vaults |
| POST | `/companies/:id/contractors` | company, platform | Link a registered contractor to a company |
| GET | `/companies/:id/contractors` | company, platform | List contractors linked to a company |
| DELETE | `/companies/:id/contractors/:contractorId` | company, platform | Deregister a contractor from a company |
| POST | `/contractors` | platform | Register a contractor |
| GET | `/contractors/:id` | any | Get contractor profile |
| POST | `/vaults` | platform | Register a deployed vault |
| GET | `/vaults/:address` | any | Look up vault by on-chain address |
| POST | `/address-mappings` | platform | Assign fresh address (ERC20Vault only) |
| GET | `/address-mappings/by-contractor` | any | Get fresh address for a contractor/vault pair |
| GET | `/address-mappings/resolve/:address` | platform | Resolve fresh address → contractor |

#### Invoices — `/api/invoices`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/` | contractor | Create invoice |
| GET | `/` | any | List invoices (role-filtered) |
| GET | `/:id` | any | Get invoice |
| POST | `/:id/approve` | company | Approve invoice |
| POST | `/:id/reject` | company | Reject invoice |
| GET | `/:id/hash` | any | Get invoice hash for on-chain registration |
| POST | `/:id/confirm-registration` | company | Record `registerInvoice` tx after on-chain confirmation |
| POST | `/:id/confirm-payment` | contractor | Record `executeCheque` tx after on-chain confirmation |
| POST | `/:id/confirm-cancellation` | company | Record `cancelCheque` tx after on-chain confirmation |

### Invoice Lifecycle

```
draft → approved → registered → paid
      → rejected
      → cancelled
```

Status transitions are strict and enforced server-side.

## Key Design Decisions

**No Event Indexer.** After a transaction confirms on-chain, the frontend reads the receipt and calls the relevant confirm endpoint. The backend stores the tx hash, block number, and chequeId against the invoice.

**Invoice hash computed server-side.** Always fetch `GET /api/invoices/:id/hash` before calling `registerInvoice` on-chain. Do not recompute locally.

**Contractor linking.** Contractors must be registered on the platform first (`POST /api/registry/contractors` with platform role). Companies then link them via `POST /api/registry/companies/:id/contractors` using the contractor's Porto Account address.

**Amounts as strings.** Invoice amounts are stored and returned as strings to avoid floating point precision loss. Parse to BigInt scaled by token decimals before passing to on-chain calls.

**ERC20Vault payee address.** The on-chain payee is the fresh address from the address mapping — not the contractor's Porto Account address. Fetch via `GET /api/registry/address-mappings/by-contractor`.
