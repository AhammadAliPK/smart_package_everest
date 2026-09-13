# PRD — Smart Package Locker Management System

> Source: `docs/Smart Package Everest Coding challenge.pdf` (Everest Engineering coding challenge, © 2026)
> Status: Approved — this document is the authoritative requirements source for the BMAD workflow.

## 1. Overview

Build a **Package Locker Management System** for self-service locker stations: delivery agents store packages in secure lockers, and customers retrieve them later using pickup codes.

**Chosen interfaces: REST API** (primary contract, decided 2026-09-13) **+ web UI** — a React SPA built on a shadcn/Tailwind component library (added 2026-09-13).

## 2. Scenario

Modern e-commerce platforms provide self-service locker systems where delivery agents can store packages for customers to pick up later. Instead of delivering packages directly to homes, packages can be delivered to secure locker stations located in convenient public places such as malls, offices, or residential complexes.

Each locker station contains lockers of **different sizes**, allowing packages of different dimensions to be stored securely. When a package is placed in a locker, the system generates a **pickup code** that is shared with the customer, who can later use it to retrieve their package. The locker system must efficiently manage **locker availability**, **package assignments**, and **package retrieval**.

## 3. System Overview

The system manages:

- Lockers of different sizes
- Packages being delivered
- Customers receiving packages
- Pickup codes used for package retrieval

**Store flow (delivery agent):**
1. The system finds a suitable and available locker
2. The package is assigned to that locker
3. A pickup code is generated
4. The pickup code is assumed to be sent to the customer through an external notification system (e.g., SMS/email) — **out of scope**

**Retrieve flow (customer):**
1. The customer provides the locker ID and pickup code
2. The system validates the request
3. The locker opens and the package is retrieved

## 4. Domain Rules

### Locker sizes
- Lockers come in three sizes: **Small**, **Medium**, **Large**
- Packages have sizes and must be placed in a locker that can hold them
- The system must always assign a package to the **smallest available locker that can accommodate it**

### Basic rules
- A locker can store only **one package at a time**
- Once a package is retrieved, the locker becomes available again
- Each stored package must have a **unique pickup code**
- A pickup code is associated with a specific package and locker
- The system must be designed so it **can be extended easily** in the future

### Roles
- **Delivery Agent** — stores packages in lockers for customers, generating pickup codes
- **Customer** — retrieves their packages using locker ID + pickup code

## 5. Requirements by Level

### Level 1 — Basic Locker and Package Storage
Implement the basic locker allocation system.

- Support creating lockers of different sizes
- Allow viewing the list of lockers along with their current availability status
- Delivery agents can store packages for customers in the locker system

When storing a package, the system must:
- Find an available locker that can accommodate the package size
- Prefer assigning the **smallest** available locker that fits the package
- If no suitable locker is available for the given package size, return a message indicating the package **cannot be stored**
- On success, generate a **pickup code** and provide the **locker identifier** where the package was stored
- Pickup-code delivery to the customer (SMS/email) is out of scope

### Level 2 — Package Retrieval and Locker Management
Extend the system to allow customers to retrieve their packages.

- Customers retrieve packages by providing the **locker identifier** and the **pickup code** they received
- On a valid pickup request:
  - The corresponding locker opens
  - The package is removed from the locker
  - The locker becomes available again for future deliveries
- Invalid scenarios (wrong code, wrong locker, already-empty locker, etc.) must be handled properly

### Level 3 — Extended Storage Charges
Extend the system to support storage charges for packages that remain in lockers for extended periods.

- When a package is stored, record the **time/day** it was placed in the locker
- Calculate storage charges based on how long the package stays in the locker
- Tiered pricing rule (example): **X units/day for the first 5 days, 2X units/day for the next 5 days, 3X units/day for any additional days**, where X is a fixed value
- A "day" is defined as **24 hours** from the time the package was stored
- On retrieval, calculate and return the **total storage charge** along with the pickup confirmation
- After retrieval, the locker becomes available again

### Level 4 — Handling Concurrent Requests (Optional)
Extend the system to correctly handle multiple delivery agents storing packages at the same time.

- Support multiple simultaneous storage requests
- A locker is given to **only one package at a time** — two different requests must never receive the same locker
- Locker availability must always remain correct and up to date
- If there are more requests than available lockers, only the available lockers are assigned; remaining requests receive a "no suitable locker available" message
- The system must behave correctly even under many simultaneous requests

## 6. Web UI & Component Library

A React SPA (`apps/web`) consumes the REST API and exposes the two roles as screens, backed by a reusable component library (`packages/ui`) built on **shadcn/ui + Tailwind CSS**.

**Delivery Agent console:**
- Create lockers of a chosen size
- View the locker station — every locker, its size, and live availability
- Store a package: enter size (+ optional customer ref) → see assigned locker and generated pickup code

**Customer view:**
- Retrieve a package: enter locker ID + pickup code → confirmation with the storage charge breakdown (days charged, tier rate, total), or a clear invalid-code/empty-locker error

**Component library (`packages/ui`):**
- shadcn/ui primitives themed for the product (buttons, inputs, cards, dialogs, tables, badges)
- Product components (e.g., `LockerGrid`, `LockerCard`, `StorePackageForm`, `RetrievePackageForm`, `ChargeSummary`)
- Presentation-only: no API calls, no business logic — composition and data fetching live in `apps/web`

## 7. Out of Scope
- Customer notification delivery (SMS/email of pickup codes)
- Physical locker hardware integration (locker "opening" is a logical state change)
- Authentication/authorization of agents and customers (unless trivial to add)
- Multi-station topology management (single station assumed; design should not preclude extension)

## 8. Success Criteria
- All Level 1–3 requirements implemented and demonstrable via the REST API **and the web UI**
- Level 4 concurrency correctness demonstrated (no double-assignment)
- Clean, extensible domain model (sizes, pricing, and station concepts extensible)
- A reusable shadcn/Tailwind component library powering the UI
- Automated tests covering happy paths and invalid scenarios
