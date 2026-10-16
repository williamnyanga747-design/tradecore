# TradeCore: Tally Accounting System, Floating Scientific Calculator & System Bug Fixes

A comprehensive upgrade integrating a Tally-style double-entry bookkeeping system (Journals, Ledger, Day Book, Trial Balance) and a universal floating Scientific/Retail Calculator drawer across TradeCore, paired with immediate fixes for NaN input attribute warnings and company-level access isolation.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and user experience decisions were established during interactive discovery and are prioritized in this implementation:

- **Confirmed Decision 1 (Tally Accounting Engine)**: Tally-style double-entry accounting with a standard Chart of Accounts (Assets, Liabilities, Equity, Incomes, Expenses), Journal Voucher creation (Debit = Credit invariant validation), General Ledger account drilling, Day Book, and Real-time Trial Balance.
- **Confirmed Decision 2 (Calculator Placement & Access)**: Universal floating trigger button in the bottom-right viewport (accessible globally from POS, Inventory, Master Data, and Accounting screens) that expands into a multi-tab quick-drawer.
- **Confirmed Decision 3 (Calculator Functional Scope)**: Dual-engine layout featuring (a) Advanced scientific math keypad (trigonometry, powers, roots, log, parentheses, precision rounding) and (b) Dedicated commercial retail tools (margin/markup calculator, inclusive/exclusive VAT/tax calculator, loan/EMI amortization calculator, and quick currency multiplier).
- **Confirmed Decision 4 (Bug Fixes Priority)**: Resolve input `value={NaN}` React attribute warnings across `PurchaseOrderModal`, `MasterData`, `POSModal`, and product price inputs by adding strict numeric sanitizers (`Number.isFinite(val) ? val : ''`). Fix company ID resolution in `ManageUsers` and `MasterData` where non-super-admin users could inadvertently access or assign cross-tenant branches/stores.

---

### 1. Overview & Core Concept

- **What It Does**: 
  1. **Tally Accounting Module**: Adds a dedicated accounting workspace within TradeCore featuring double-entry voucher entry (Payment, Receipt, Journal, Contra, Sales, Purchase vouchers), Chart of Accounts management, Ledger Account views with running balances, Day Book transaction logs, and an auto-balancing Trial Balance.
  2. **Universal Floating Scientific & Commercial Calculator**: Adds a quick-access drawer available everywhere in TradeCore (including the active POS cashier screen) with one-click "Copy Result to Cart / Input" capability, supporting scientific functions, commercial margin/markup calculations, multi-rate tax/VAT computations, and loan amortization tables.
  3. **Robust Input & Isolation Fixes**: Patches numeric input bindings across the app to eliminate React `NaN` attribute warnings and prevents cross-company data leakage when managing branches, stores, and users.
- **Target Audience / Persona**: Retail managers, business owners, accountants, cashiers, and store supervisors who need rapid calculation tools during sales operations and compliant double-entry financial record-keeping without leaving the TradeCore POS/ERP suite.
- **Key Value**: Unifies operational sales/inventory with standard financial accounting principles, eliminates calculation errors at checkout/procurement, and hardens data stability.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Accounting Navigation & Voucher Entry**:
   - User navigates to the new **"Accounting (Tally)"** section from the primary navigation.
   - User clicks **"New Journal Voucher"** (or uses keyboard shortcuts `Alt+J`).
   - Voucher modal opens with multi-row debit/credit entries, account selectors, cost center/reference fields, and dynamic live balance indicator ensuring Debits strictly equal Credits before posting.
   - Upon posting, journal entries update the General Ledger and Trial Balance in real-time.
2. **Account Ledger Inspection**:
   - User selects an account (e.g., Cash, Bank, Accounts Receivable, Inventory) to see running debit/credit columns, voucher references, and period closing balance.
   - Ability to filter by date range, branch, or voucher type and export/print ledger statements.
3. **Floating Scientific & Commercial Calculator**:
   - A discreet floating icon button (`calc`) rests in the bottom-right corner of the interface (z-index 60, non-intrusive).
   - Clicking (or pressing keyboard shortcut `Ctrl/Cmd + Alt + C`) smoothly slides open a clean, compact drawer with tabs:
     - **Tab 1: Scientific Calculator**: Interactive display with expression history, DEG/RAD toggle, trig (`sin`, `cos`, `tan`), algebraic functions ($x^y$, $\sqrt{x}$, $\log$, $\ln$), memory recall (`M+`, `M-`, `MR`, `MC`), and clean large numpad.
     - **Tab 2: Margin & Markup**: Inputs for Cost and Selling Price, automatically calculating Gross Margin %, Markup %, and Profit Amount.
     - **Tab 3: VAT / Tax Engine**: Inputs for Net or Gross Amount + Tax Rate %, calculating exclusive/inclusive tax breakdowns with instant "Apply to Active Field" button.
     - **Tab 4: Loan / EMI Amortization**: Principal, Annual Interest Rate %, and Tenure (Months/Years) computing monthly payment, total interest, and full amortization schedule.
4. **POS & Procurement Integration**:
   - Inside POS checkout or Purchase Order creation, clicking the calculator allows direct pasting of computed margins or totals into discount/price fields.

#### Visual Identity & Theme
- **Aesthetic Direction**: High-density, professional enterprise utility following TradeCore's executive styling. Anti-slop compliance: no decorative pulsing dots, no artificial telemetry tickers, clean unboxed metadata with typographic separators (`·`).
- **Color Palette**:
  - Dominant Canvas: Clean crisp slate/zinc surface (`bg-slate-50 dark:bg-zinc-950`).
  - Structural Surfaces: Card & panel boundaries with 1px hairline borders (`border-slate-200 dark:border-zinc-800`).
  - Brand Accent: High-intent indigo/emerald accents (`bg-indigo-600 hover:bg-indigo-700`, `text-indigo-600`) reserved strictly for primary actions, active tabs, and debit/credit balances.
  - Semantic Accounting Statuses: Muted emerald for credits/surplus (`text-emerald-700 bg-emerald-50/60`), subtle slate/rose for debits (`text-rose-700 bg-rose-50/60`).
- **Typography & Tabular Discipline**:
  - Headings: `Plus Jakarta Sans` or clean modern neo-grotesque sans with balanced measure.
  - Tabular Figures: Strict `font-mono tabular-nums` for all financial ledger amounts, running debit/credit totals, scientific calculator expressions, and amortization tables.
- **Interactive Feedback**:
  - Drawer slide-out transition settles in $\le 180\text{ms}$ with smooth bezier easing.
  - Instant live error indicators on unbalanced journal vouchers (red diff badge showing imbalance amount until Debit = Credit).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Modular Tally Accounting vs. Basic Cashbook**
  - *Chosen Approach*: Implement a true double-entry bookkeeping engine with standard account types (Assets, Liabilities, Equity, Revenues, Expenses) and standard voucher types (Journal, Payment, Receipt, Contra, Sales, Purchase).
  - *Why*: User explicitly requested "Tally-style double-entry accounting with journals and ledger". Simple single-entry cashbooks fail audit compliance and do not support balance sheet / trial balance generation.
  - *Alternatives Considered*: Read-only expense tracking was rejected as it does not satisfy the Tally requirement.
- **Decision 2: Floating Drawer vs. Modal or Standalone Page for Calculator**
  - *Chosen Approach*: Persistent bottom-right floating trigger button that slides out a dedicated docked panel or drawer.
  - *Why*: Allows cashiers in POS and procurement managers in Purchase Orders to perform multi-step math without losing their place, closing modals, or leaving the current transaction.
  - *Alternatives Considered*: Standalone page was rejected as it forces page reload and loses in-flight cart data.
- **Decision 3: Sanitized Numeric State vs. Direct Raw Event Values**
  - *Chosen Approach*: Replace vulnerable `value={val}` attributes in numeric inputs with guarded conversions: `value={val === undefined || val === null || Number.isNaN(val) ? '' : val}` and parse inputs safely.
  - *Why*: Completely eliminates the React warning *"Received NaN for the `%s` attribute"*, preventing runtime crashes when inputs are cleared or exchange rates are zero.
- **Decision 4: Multi-Tenant Company Scope Enforcement**
  - *Chosen Approach*: Normalize `companyId` / `company_id` across session users, and strictly enforce that non-super-admins cannot alter or select foreign companies in `ManageUsers` or `MasterData`.
  - *Why*: Prevents company data bleed and ensures branch/store isolation.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TradeCore Main App Shell                        │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation Bar  │  Main Content Viewport                          │
│  [Pos, Inventory,    │  ┌──────────────────────┐  ┌──────────────────┐ │
│   Master Data,       │  │ Tally Accounting Hub │  │ POS / Operations │ │
│   Accounting (NEW)]  │  │  · Chart of Accounts │  │  · Cart          │ │
│                      │  │  · Journal Vouchers  │  │  · Checkout      │ │
│                      │  │  · General Ledger    │  │  · Orders        │ │
│                      │  │  · Trial Balance     │  │                  │ │
│                      │  └──────────────────────┘  └──────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│  Global Floating Trigger (Bottom Right)                                │
│  └─► [ Scientific & Retail Calculator Drawer ]                         │
│       ├─ Scientific Engine (sin, cos, exp, log, brackets, memory)      │
│       ├─ Retail Margin & Markup Calculator                             │
│       ├─ VAT & Sales Tax Calculator (Inclusive / Exclusive)            │
│       └─ Loan / EMI Amortization Schedule Engine                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Persistent State & Storage (LocalStorage + API)            │
│  · accounts: Account[]                                                 │
│  · journalVouchers: JournalVoucher[]                                   │
│  · accountingSettings: CompanyAccountingConfig                         │
│  · calculatorHistory: CalcHistoryItem[]                                │
└────────────────────────────────────────────────────────────────────────┘
```

#### Core Data Entities

1. **`Account`**:
   - `id`: string
   - `companyId`: string
   - `code`: string (e.g., "1000", "2000")
   - `name`: string (e.g., "Cash on Hand", "Accounts Receivable", "Sales Revenue")
   - `type`: `'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'`
   - `category`: string (e.g., "Current Assets", "Direct Expenses")
   - `openingBalance`: number (positive for normal balance)
   - `currentBalance`: number

2. **`JournalVoucher`**:
   - `id`: string
   - `voucherNo`: string (e.g., "JV-2026-001")
   - `companyId`: string
   - `date`: string (ISO date)
   - `type`: `'Journal' | 'Payment' | 'Receipt' | 'Contra' | 'Sales' | 'Purchase'`
   - `narration`: string
   - `entries`: Array<{
       `id`: string,
       `accountId`: string,
       `accountName`: string,
       `type`: `'Debit' | 'Credit'`,
       `amount`: number,
       `notes`?: string
     }>
   - `totalDebit`: number
   - `totalCredit`: number
   - `createdAt`: string
   - `createdBy`: string

3. **`CalculatorState`**:
   - `currentDisplay`: string
   - `formulaDisplay`: string
   - `memory`: number
   - `history`: Array<{ id: string, formula: string, result: string, timestamp: number }>
   - `margin`: { cost: number, price: number, marginPercent: number, markupPercent: number }
   - `vat`: { baseAmount: number, rate: number, taxAmount: number, totalAmount: number, mode: 'exclusive' | 'inclusive' }
   - `loan`: { principal: number, annualRate: number, tenureMonths: number, monthlyPayment: number, totalInterest: number, totalPayment: number }

#### State Transitions & Handlers
- **Voucher Validation**: `validateVoucher()` ensures `Math.abs(totalDebit - totalCredit) < 0.001` and at least 2 entries exist before saving.
- **Posting Logic**: Appends voucher to `journalVouchers` and synchronously updates affected account balances.
- **Calculator Paste**: `onApplyValue(val)` callback allows direct transfer of calculator results into active input fields (e.g., POS discount, order line cost).
- **NaN Input Guard**: Standardized helper `safeNumInput(value)` applied across all numeric `<input>` controls.

---

### Execution Roadmap

1. **Phase 1: Critical Bug Fixes (NaN & Company Scope)**
   - Sanitize all `<input type="number">` bindings in `PurchaseOrderModal.tsx`, `MasterData.tsx`, `POSModal.tsx`, and `App.tsx`.
   - Fix company ID normalization and isolation in `ManageUsers.tsx` and `MasterData.tsx`.
2. **Phase 2: Floating Scientific & Retail Calculator Drawer**
   - Create `src/components/ScientificCalculatorDrawer.tsx` with Scientific, Margin, VAT, and Loan calculation modes.
   - Integrate floating trigger button in `App.tsx` with global keyboard shortcut (`Ctrl+Alt+C`).
3. **Phase 3: Tally-Style Double-Entry Accounting Module**
   - Create `src/components/AccountingTally.tsx` featuring Chart of Accounts, Journal Voucher creation, General Ledger, Day Book, and Trial Balance.
   - Seed default standard Chart of Accounts for company setup.
   - Add Accounting link to main navigation for authorized users.
4. **Phase 4: Verification & Build**
   - Compile applet with `compile_applet` and test all edge cases.
