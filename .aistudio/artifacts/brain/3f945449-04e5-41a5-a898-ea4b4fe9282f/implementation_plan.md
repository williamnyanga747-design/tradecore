# Shift Cash Float, Transfer Handshake & FEFO Expiry Architecture

Deliver three enterprise-grade inventory and financial capabilities: active POS drawer cash float expense linking with automatic shift reconciliation, a robust two-step stock transfer handshake (Dispatch to Inspection & Confirmation with automated discrepancy loss write-offs), and FEFO (First-Expired, First-Out) inventory dispatching with tiered 30-day and 7-day expiration alert ribbons.

***

### User Review & Critical Decisions

> [!IMPORTANT]
> The following operational parameters were confirmed through the planning interview:
> - **Unified Release Scope**: All three features will be implemented together in this release to provide immediate end-to-end operational synergy across the POS, inventory, and expense workflows.
> - **Transfer Discrepancies**: Quantity discrepancies and damaged goods reported during branch delivery confirmation will be automatically recorded as inventory loss adjustments with store-level shrinkage audit trails.
> - **FEFO Alert Thresholds**: Tiered warnings will trigger at **30 days** (Amber early warning) and **7 days** (Red urgent action) before expiration across the inventory catalog and POS item cards.

- **Confirmed Decision 1**: POS drawer cash expense disbursements will automatically subtract from the active register shift's expected closing cash balance (`Expected = Opening Float + Cash Sales - Drawer Expenses`).
- **Confirmed Decision 2**: When receiving a dispatched transfer, the destination manager can inspect items, confirm intact received quantities, log damaged or missing units, and finalize receipt with zero inventory ghosting.
- **Confirmed Decision 3**: The inventory consumption engine will sort batches by `expiryDate` ascending (FEFO) before fallback to `receivedDate` (FIFO), ensuring perishable items are always prioritized for sales.

***

## 1. Overview & Core Concept

### What It Does
1. **Shift Cash Float & Expense Linking**: Allows cashiers and store admins to record operating expenses (e.g., store supplies, courier fees, emergency utilities) directly out of the active register drawer. The disbursed amount is linked to the active `PosShift` session, decrementing the expected closing drawer cash so the end-of-shift Z-Report balances perfectly.
2. **Two-Step Stock Transfer Handshake**: Upgrades stock movement between stores into an auditable two-step lifecycle:
   - *Step 1 (Dispatch)*: Origin store prepares manifest, checks source inventory, deducts units, and marks status as `In-Transit`.
   - *Step 2 (Inspection & Handshake)*: Destination store receives the manifest, performs physical inspection, enters accepted quantities alongside damaged/missing counts, and commits the transfer. Missing/damaged units are automatically written off to inventory shrinkage.
3. **Batch Expiry & FEFO (First-Expired, First-Out)**: Enforces proactive expiration management. The sales checkout engine automatically depletes batches with the earliest expiry dates first. Visual alert badges highlight products within 30 days and 7 days of expiration.

### Target Audience & Persona
- **Cashiers & POS Operators**: Record petty cash payouts without leaving the POS station, ensuring their closing cash drawer count matches system expectations without manual arithmetic.
- **Store Managers & Receiving Staff**: Inspect physical shipments, record verified counts, and protect against inventory discrepancies between branches.
- **Inventory Controllers & Business Owners**: Prevent stock spoilage and monitor multi-branch movement with full audit visibility.

### Key Value
- **Zero Cash Discrepancy Panic**: Cashiers never face unexplainable drawer shortfalls due to unrecorded midday cash expenses.
- **Tamper-Evident Stock Transfers**: Eliminates discrepancies where origin branches claim goods were sent that destination branches never received.
- **Minimized Spoilage & Write-offs**: Perishable products approaching expiration dates are automatically prioritized and flagged.

***

## 2. User Experience & Visual Design

### Key User Flows

#### Flow A: Drawer Cash Expense Linking
```
[ POS Station / Expenses ]
         │
         ▼
[ Record Expense Modal ] ──► Toggle "Pay from Active POS Drawer Float"
         │
         ▼
[ Cash Balance Verified ] ──► System ensures drawer has sufficient float
         │
         ▼
[ Expense Logged ] ──► Linked to active PosShift ID with receipt upload
         │
         ▼
[ Shift Close-Out ] ──► Z-Report reflects:
                         Opening Float:            +$100.00
                         Cash Sales:               +$450.00
                         Drawer Cash Expenses:     -$ 35.00
                         ──────────────────────────────────
                         Expected Cash in Drawer:   $515.00
```

#### Flow B: 2-Step Transfer Handshake & Inspection
```
[ Origin Store ]
         │
         ▼
[ Create Transfer ] ──► Select Item, Source & Destination Store, Quantity
         │
         ▼
[ Dispatch Action ] ──► Stock deducted from Source, Status: "In-Transit"
         │
         ▼
[ Shipment in Transit ]
         │
         ▼
[ Destination Store ] ──► Inspect Shipment Banner in Stock Management
         │
         ▼
[ Inspect & Receive Modal ] ──► Input Received Units, Damaged Units, Missing Units
         │
         ├─ All Intact (Received = Sent) ──► Full inventory added to destination
         │
         └─ Discrepancy Found ─────────────► Accepted units added to destination;
                                             Damaged/missing units logged as Loss Adjustment
```

#### Flow C: FEFO Prioritization & Early Warning Alerts
- **Catalog View**: Products with batches expiring within 30 days show an Amber warning banner; products with batches expiring within 7 days show a Red urgent banner with remaining shelf days.
- **POS Card View**: Cashiers see small, clean batch expiry markers next to product names so they know which stock to physically pick first.
- **Consumption Engine**: During checkout, `calculateFEFOCost` consumes batches sorted by `expiryDate ASC`, updating remaining shelf quantities.

### Visual Identity & Theme
- **Clean SaaS & Dashboard Aesthetic**: Adhering to the Universal Frontend Design Constitution and SaaS Dashboard standards:
  - **No Pill Badges**: Metadata rendered as clean unboxed text with typographic separators (`·`, `/`).
  - **Single Elevation Depth**: Flat white / slate cards with subtle `border border-slate-200 dark:border-slate-800`.
  - **Tabular Figures**: All currencies, quantities, timestamps, and shelf-life countdowns use `font-mono tabular-nums`.
  - **Palette**: Deep slate canvas (`#0F172A`), crisp white structural cards (`#FFFFFF`), Emerald (`#16A34A`) for verified received goods, Amber (`#D97706`) for 30-day warnings, and Crimson (`#DC2626`) for 7-day expiration and damaged discrepancies.

***

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Shift Expense Linking** | Direct foreign key link (`posShiftId`) on `Expense` | Allows expenses logged anywhere (Expenses panel or POS drawer payout button) to affect the active register session in real time. | Separate "Cash Drops / Payouts" table; rejected to avoid data duplication and keep accounting reports unified. |
| **Transfer Discrepancy Accounting** | Auto-record discrepancy as inventory loss adjustment with audit entry | Immediately reflects reality in physical inventory without holding up the receiving branch's workflow. | Blocking the transfer until origin confirms; rejected as it creates operational bottlenecks and stalls sales. |
| **FEFO vs FIFO Batch Sorting** | Primary sort by `expiryDate ASC`, secondary sort by `receivedDate ASC` | Perishable products are consumed by earliest expiration date first, protecting profitability. | Strict FIFO only; rejected because later-received goods with shorter expiration dates would spoil on shelves. |
| **Expiry Warning Tiers** | Tiered 30-day (Amber) and 7-day (Red) thresholds | Provides two distinct operational phases: promotional discount window (30d) vs urgent shelf clearance (7d). | Single static threshold; rejected because a single warning does not give advance promotional time. |

***

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TradeCore ERP Core State                        │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │      posShifts        │  │     expenses      │  │ stockTransfers │  │
│  │ ───────────────────── │  │ ───────────────── │  │ ────────────── │  │
│  │ id                    │  │ id                │  │ id             │  │
│  │ openingFloat          │  │ posShiftId        │  │ fromStoreId    │  │
│  │ expectedCashSales     │  │ paidFromDrawer    │  │ toStoreId      │  │
│  │ drawerExpensesTotal   │  │ amount            │  │ qty            │  │
│  │ closingCashActual     │  │ receiptUrl        │  │ receivedQty    │  │
│  │ variance              │  └───────────────────┘  │ damagedQty     │  │
│  └───────────────────────┘                         │ missingQty     │  │
│             ▲                                      │ status         │  │
│             │ links to session                     └────────────────┘  │
│             └───────────────────────────────┐               │          │
│                                             │               ▼          │
│  ┌───────────────────────┐     ┌────────────────────────────────────┐  │
│  │     POSModal.tsx      │     │       StockTransferHandshake       │  │
│  │ ───────────────────── │     │ ────────────────────────────────── │  │
│  │ Quick Drawer Cash Out │     │ Step 1: Dispatch (deduct origin)   │  │
│  │ FEFO Batch Selection  │     │ Step 2: Inspection Modal           │  │
│  │ Z-Report Summary Slip │     │ Auto Loss Write-Off Adjustment     │  │
│  └───────────────────────┘     └────────────────────────────────────┘  │
│             │                                       │                  │
│             ▼                                       ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       src/utils/fifo.ts                          │  │
│  │  calculateFEFOCost(product, storeId, qty)                        │  │
│  │  -> Sorts by expiryDate ASC -> receivedDate ASC                  │  │
│  │  -> Deducts batch quantities & computes true COGS                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model Enhancements

1. **`PosShift` (in `src/types.ts`)**:
   - `drawerExpensesTotal?: number` — Cumulative cash expenses paid from this drawer.
   - `expenseIds?: number[]` — References to all expenses paid during this shift.

2. **`Expense` (in `src/types.ts`)**:
   - `posShiftId?: number` — ID of the active register shift session (if paid from drawer).
   - `paidFromDrawerFloat?: boolean` — Flag indicating whether cash was pulled directly from POS drawer.

3. **`StockTransfer` (in `src/types.ts`)**:
   - `receivedQty?: number` — Actual accepted count verified at destination.
   - `damagedQty?: number` — Count of items found broken/spoiled upon arrival.
   - `missingQty?: number` — Count of items missing in transit.
   - `discrepancyReason?: string` — Receiving inspection remarks.
   - `receivedBy?: string` — Name of receiving staff member.
   - `dispatchedBy?: string` — Name of dispatching staff member.

4. **`InventoryBatch` (in `src/types.ts`)**:
   - Ensure `expiryDate?: string` is consistently tracked and surfaced across batch creation and transfer workflows.

### Execution Plan (Turn 3)
1. **Type & Utility Upgrade**:
   - Update `src/types.ts` with the new fields on `PosShift`, `Expense`, and `StockTransfer`.
   - Update `src/utils/fifo.ts` to implement FEFO sorting (`expiryDate` ascending, then `receivedDate` ascending).
2. **POS Modal & Expenses Integration**:
   - In `POSModal.tsx`:
     - Add a dedicated **"Cash Out / Drawer Expense"** action button in the register drawer section allowing instant payment of petty expenses.
     - Update closing shift reconciliation math: `expectedTotal = openingFloat + expectedCashSales - drawerExpensesTotal`.
     - Update the Z-Report closeout slip to display `Drawer Expenses Paid Out`.
   - In `Expenses.tsx`:
     - When logging an expense with payment method "Cash", provide a checkbox: *"Pay from Active POS Drawer Float"* (enabled only when an open shift exists for the current store).
3. **Stock Transfer Handshake & Inspection**:
   - Upgrade the Stock Transfer UI in `src/App.tsx`:
     - Introduce **"Inspect & Confirm Arrival"** modal for destination stores on `In-Transit` transfers.
     - Allow staff to enter `receivedQty`, `damagedQty`, `missingQty`, and `inspectionNotes`.
     - Auto-write-off any discrepancy into inventory loss with clear audit logging.
     - Add status badge indicators: `Pending`, `In-Transit`, `Completed`, `Discrepancy Reconciled`, `Rejected`.
4. **FEFO Expiry Warnings**:
   - In Stock Items & POS:
     - Compute days-to-expiry for all products and active batches.
     - Add visual status ribbons: Amber (`< 30 days`), Red (`< 7 days`), Gray (`Expired`).
5. **Compilation & Verification**:
   - Run `compile_applet` and `lint_applet` to ensure zero compilation or type issues.
