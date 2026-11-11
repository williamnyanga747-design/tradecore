# Implementation Plan: Company Agent Authentication & Performance Payout Workspace

## Executive Summary
This plan resolves the issue where company agents are unable to log in to track their work performance and apply for payments. It establishes dual-entry authentication (via both the main login modal and the agent portal), synchronizes agent profiles with system credentials, and introduces a dedicated **Agent Performance & Payment Workspace** with real-time sales telemetry, commission ledgers, and mobile money payout requests (M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, Bank).

---

## Proposed Changes

### 1. Type Definitions & Data Model (`src/types.ts`)
- Extend `User['role']` to include `'Agent'` (`'Super Admin' | 'Admin' | 'Branch Administrator' | 'Store Admin' | 'Retailer' | 'Wholesaler' | 'Agent'`).
- Add optional `affiliateId?: number` and `referralCode?: string` to `User` interface to link user sessions directly to their agent record.
- Ensure `Affiliate` and `AffiliateWithdrawal` contracts support all standard Tanzanian payment rails (`mpesa`, `tigopesa`, `airtel`, `halopesa`, `bank`).

### 2. Dual-Entry Agent Authentication Engine (`src/App.tsx`)
- **Main Login Flow Enhancement (`handleLogin`)**:
  - Update user resolution logic: If credentials do not match standard staff accounts, automatically search the `affiliates` registry by `phone`, `referralCode`, `email`, or clean name.
  - Verify credentials against the agent's hashed password or default company PIN (`1234` or phone suffix).
  - On successful verification, instantiate an authenticated `User` session with `role: 'Agent'`, populated with their company ID, name, phone, and affiliate ID.
  - Automatically route logged-in agents to their dedicated Agent Performance Workspace.
- **Login Modal UI Enhancement**:
  - Add a dedicated "Agent / Wakala" login toggle or badge on the main login modal to guide company agents on entering their phone number or referral code.
- **Agent Creation Synchronization (`createAffiliateAgent`)**:
  - When Company Admins register an agent in `AffiliateProgramPanel`, synchronously create both an `Affiliate` record and a `User` record (`role: 'Agent'`), ensuring immediate credential validity across all login points.

### 3. Agent Performance & Payout Workspace Component (`src/components/AgentPerformancePortal.tsx`)
Create a dedicated, modern dashboard for company agents featuring:
- **Telemetry & Work Performance Overview**:
  - Live KPI cards: Total Referred Sales GMV, Commission Earned, Pending Commissions, Available Balance, and Conversion Clicks.
  - Shareable referral link with one-click copy and instant QR code generator for customer onboarding.
  - Scoped to the agent's assigned company.
- **Referred Customer Orders & Commission Ledger**:
  - Real-time table of customer orders referred by the agent.
  - Details: Order date, items, total amount, commission rate %, commission earned, and status (`Pending`, `Approved`, `Paid`).
- **Payment Application (Withdrawal Request Modal & Form)**:
  - "Apply for Payout" interface allowing agents to submit payment requests from their available commission balance.
  - Provider selection: Vodacom M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, or Bank Transfer (CRDB, NMB, etc.).
  - Phone number / account validation and minimum withdrawal threshold enforcement.
  - Real-time deduction from available balance upon submission.
- **Withdrawal History & Status Tracker**:
  - Chronological list of payment requests with live status pills (`pending`, `approved`, `rejected`), payment reference, and settlement timestamp.

### 4. Admin Review & Settlement Flow (`src/components/AffiliateProgramPanel.tsx` & `src/App.tsx`)
- Ensure Company Admins can view agent performance, inspect pending payment requests, and approve/settle payouts with payment transaction references.
- Enable Company Admins to edit agent commission rates or reset agent login passwords directly.

---

## Verification Plan

### Automated Build & Syntax Checks
1. Compile the applet with `compile_applet`.
2. Run full TypeScript static analysis with `lint_applet` (`tsc --noEmit`).

### Functional Verification Scenarios
1. **Agent Registration & Sync**:
   - Create a new agent from `AffiliateProgramPanel` under the active company with a phone number and custom password.
   - Verify both `affiliates` and `users` register the agent with role `'Agent'`.
2. **Main Login Verification**:
   - Log out and log in using the newly created agent's phone number or referral code and password via the main login modal.
   - Verify smooth authentication without "User not found" errors.
3. **Agent Portal Verification**:
   - Access the dedicated Agent Workspace.
   - Verify KPI cards display correct balances and referral codes.
4. **Performance & Commission Tracking**:
   - Verify customer orders attributed to the agent's referral code appear in the performance ledger.
5. **Payment Application (Withdrawal)**:
   - Submit a payout request via M-Pesa.
   - Verify available balance updates, the request appears in the withdrawal history, and the Company Admin can review/approve the payment.
