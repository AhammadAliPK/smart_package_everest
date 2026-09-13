# Adversarial Review — ARCHITECTURE-SPINE.md (2026-09-13)

Method: two imagined epics — A (storage/allocation: `CreateLocker`, `ListLockers`, `StorePackage`) and B (retrieval/charging: `RetrievePackage`) — built by different devs from the spine alone, each AD-compliant, yet mutually incompatible. Each divergence below is a hole to close.

**Verdict: spine is sound in shape (hexagonal, AD-2/AD-4/AD-8 ownership) but under-specified at the A/B seam — 2 CRITICAL, 3 HIGH, 1 MEDIUM. Fixable with 6 tightened ADs; do not start epics until AD-6b/AD-9 land.**

---

**F1 — CRITICAL — Locker identity: `id` vs human-facing code.**
Scenario: Epic A returns both `lockerId` (cuid) and a display `code` ("A12") from `POST /lockers`/`POST /packages` (nothing forbids it); Epic B validates `POST /pickups` on the cuid, so customers holding only "A12" can never retrieve.
Tighten (new AD-9): "A locker has exactly one identifier, the cuid `id`. All payloads (store response, `GET /lockers`, `POST /pickups` request) use the field name `lockerId` carrying that cuid; no secondary display code exists in v1."

**F2 — CRITICAL — Pickup-code reuse vs stale-row lookup.**
Scenario: AD-6 makes codes unique only among *unretrieved* packages, so Epic A regenerates a code after retrieval; Epic B looks up by `pickupCode + lockerId` without a status predicate, matches the old RETRIEVED row, and charges/frees the wrong package — both letter-compliant.
Tighten (AD-6 addition): "Retrieval resolves the package in exactly one query: `pickupCode = ? AND lockerId = ? AND status = 'STORED'`; no match is `INVALID_PICKUP_CODE`. Codes are never regenerated for reuse."

**F3 — HIGH — Concurrent store vs retrieve on the same locker (lost free/occupy).**
Scenario: Epic B's retrieve transaction updates only the package row and writes `locker.occupied=false` at commit; Epic A's store (AD-3 `SKIP LOCKED` on available lockers) grabbed the locker in between and marked it occupied — the later free write wins and an occupied locker reads available.
Tighten (AD-4 addition): "Retrieval locks the locker row (`SELECT … FOR UPDATE`) or performs a guarded CAS `UPDATE Locker SET occupiedBy=null WHERE id=? AND occupiedBy=?` before writing the package; every occupancy mutation is a compare-and-swap on `occupiedBy`, never a blind boolean write."

**F4 — HIGH — `storageCharge` integer scale undefined.**
Scenario: AD-5 says "integer-unit", the conventions table says "minor-free units"; Epic A returns `storageCharge: 30` meaning minor units (0.30), Epic B's confirmation payload/preview treats it as 30.00 whole units — `STORAGE_FEE_BASE` inherits the same ambiguity.
Tighten (AD-5 addition): "`storageCharge` and `STORAGE_FEE_BASE` are integer *minor* currency units (1 = 0.01); X default 10 means 0.10; no floats, no currency symbol fields; the response also carries `currency` (default from env)."

**F5 — HIGH — `GET /lockers` shape unfixed.**
Scenario: AD-1 mandates TypeBox schemas but not their content; Epic A ships `{lockers:[{id,size,occupied}]}`, Epic B (for its availability check) ships `{items:[{lockerId,status:'AVAILABLE'}]}` — both compliant, every shared client/test breaks.
Tighten (AD-1 addition): "The Level-1 list contract is fixed verbatim: `200 {lockers: [{id, size, occupied: boolean}]}`, ordered by `id`; `occupied` is the only availability field; no per-locker package detail in v1."

**F6 — MEDIUM — Prisma isolation level unpinned; serializable drift with no error path.**
Scenario: Epic A trusts the READ COMMITTED default (fine with SKIP LOCKED); Epic B wraps retrieval in `Serializable` to "protect" the charge read, causing serialization failures (P2034) that AD-7 has no code for — no retry, no mapping, 500s under concurrency.
Tighten (AD-3 addition): "All transactions run at the Postgres default READ COMMITTED; raising isolation is forbidden in v1 — correctness comes from row locks and CAS updates only; Prisma P2034 maps to `INTERNAL_ERROR` 500 with a bounded (3×) retry in the repository."
