# Implementation Plan — Smart Selling & Subpanels Activation

Activate and functionalize all Smart Selling subpanels (Nunua Pamoja / Group Buy, Lipa Pole Pole / Installments, Live Shopping Mubashara, Mazungumzo ya Bei / Offers) in the Seller Phase 2C management panel and synchronize with buyer marketplace flows.

---

## 1. User Review Required

> [!IMPORTANT]
> The following core behaviors are aligned with your selections:
> - **All subpanels enabled**: Group Buy verification, Installment milestone recording, Live stream controls.
> - **Lipa Pole Pole**: Detailed milestone schedule with manual payment recording and receipt verification.
> - **Nunua Pamoja**: Automated completion when minimum buyers are reached, triggering notifications and delivery tasks.

---

## 2. Proposed Architecture & Smart Selling Capabilities

### A. Lipa Pole Pole (Installments) Subpanel (`SellerPhase2CPanel.tsx` & `App.tsx`)
1. **Configured Plans Management Section ("Mipango Iliyosanidiwa")**:
   - List all installment plans configured for the seller's products.
   - Display down payment %, number of installments, interest %, and product pricing.
   - Active/Inactive toggle switch and delete/deactivate button.
2. **Customer Installment Orders Section ("Maagizo ya Lipa Pole Pole")**:
   - Display buyer's full delivery location (`customerRegion`, `customerDistrict`, `customerWard`, `customerStreet`).
   - Visual progress bar and milestone tracker: Down payment status + individual installment milestones (Awamu ya 1, Awamu ya 2, etc.) with due dates and payment status.
   - Complete payment log with amounts, transaction IDs, payment methods, and previewable receipts.
3. **"Rekodi / Thibitisha Malipo ya Awamu" Action**:
   - Modal allowing the seller to record an offline/direct payment (Cash, M-Pesa, Tigo Pesa, Airtel Money, Bank) made by the customer.
   - Auto-updates `paidInstallments`, `totalPaid`, `remaining`, and sets status to `'completed'` upon full settlement.
   - Triggers customer SMS/notification and delivery task upon completion.

### B. Nunua Pamoja (Group Deals) Subpanel (`SellerPhase2CPanel.tsx` & `App.tsx`)
1. **Participant Verification**:
   - Display participants with their full delivery address, transaction ID, and receipt image.
   - Add **"Thibitisha Malipo"** button for participants with pending or manual payments, changing status from `'joined'` to `'paid'`.
   - Direct Call (`tel:`) and WhatsApp (`https://wa.me/`) buttons for each participant.
2. **Automated & Manual Deal Completion**:
   - When participant payments reach `minBuyers`, automatically transition deal status to `'completed'`.
   - Dispatch notifications to all paid members and auto-generate Bodaboda delivery tracking records for each paid participant.
   - Add **"Kamilisha Deal Sasa"** and **"Sitisha Deal"** controls for the seller.
3. **Share & Preview Controls**:
   - Copy public deal link / code and quick-view deal page in marketplace.

### C. Live Shopping Mubashara Subpanel (`SellerPhase2CPanel.tsx` & `App.tsx`)
1. **Broadcast Control**:
   - For scheduled streams: **"Anzisha Mubashara Sasa (Go Live)"** button calling `startLiveStream`.
   - For active streams: **"Maliza Live Stream (End Stream)"** button calling `endLiveStream`.
2. **Stream Management & Quick Links**:
   - Stream key display with copy button, open live viewer page (`/live/{streamKey}`), real-time viewer count and like tally.

### D. Mazungumzo ya Bei (Piga Bei / Offers) Subpanel
1. Ensure accepted and paid offers display complete delivery address (Mkoa, Wilaya, Kata, Mtaa) and transaction ID with click-to-preview receipt modal.
2. Direct action to assign Bodaboda delivery rider with one click.

---

## 3. Implementation Steps

1. **Update `App.tsx` Handlers**:
   - Implement `verifyParticipantPayment(participantId: number)`.
   - Implement `closeGroupDeal(dealId: number, status: 'completed' | 'cancelled')`.
   - Implement `toggleInstallmentPlan(planId: number)`.
   - Implement `recordManualInstallmentPayment(orderId: number, amount: number, txId?: string, receiptImage?: string)`.
   - Pass `startLiveStream` and `endLiveStream` directly into `SellerPhase2CPanel`.

2. **Enhance `SellerPhase2CPanel.tsx`**:
   - Update `SellerPhase2CPanelProps` interface with the new handlers.
   - Re-architect `renderInstallments()` to include configured plans list and detailed order milestone management.
   - Add "Rekodi Malipo ya Awamu" modal with transaction ID and receipt upload.
   - Re-architect `renderDeals()` with participant verification, WhatsApp contact links, and deal conclusion buttons.
   - Add stream start/stop controls to `renderLive()`.

3. **Verification**:
   - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
   - Verify all subpanel tabs render cleanly with responsive controls.
