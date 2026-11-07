# WebAuthn Hardware Biometric Authentication & Passkey Security Upgrade

Implement a true hardware-backed WebAuthn biometric module for TradeCore ERP. This replaces mock animation loops with genuine operating system biometric challenges (Touch ID, Windows Hello, Android Biometrics), removes the insecure public account picker from the login screen in favor of discoverable passkeys, strictly gates biometric sign-in visibility to enrolled devices, and ensures zero unauthorized access.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed in Phase 1:

- **Confirmed Decision 1 (User Identification)**: Discoverable WebAuthn credentials (resident keys) without a public account dropdown. The device biometric sensor identifies the authorized account via cryptographic assertion rather than exposing a selectable user list to unauthenticated guests.
- **Confirmed Decision 2 (Hardware Enforcement & Fallback)**: Strict WebAuthn hardware enforcement. If the biometric scan is cancelled, times out, or fails verification, the application strictly aborts sign-in and directs the user to standard password authentication. No simulated bypass is permitted.
- **Confirmed Decision 3 (Login Screen Biometric Gate)**: The "Sign In with Fingerprint / Passkey" button on the login screen will only be rendered when both the browser/device supports a platform authenticator (`isUserVerifyingPlatformAuthenticatorAvailable()`) AND at least one enrolled biometric credential exists on the device.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades biometric authentication in TradeCore ERP from simulated progress timers to genuine, tamper-resistant FIDO2/WebAuthn platform credentials. Users register their device fingerprint (Touch ID / Windows Hello / Android Biometrics) from their Profile after verifying their current password. On the Sign In screen, users can touch their sensor to instantly and securely authenticate their specific identity without revealing other user profiles or accounts to passersby.
- **Target Audience / Persona**: Cashiers, store managers, branch administrators, and executive super admins using laptops, tablets, or phones equipped with biometric sensors.
- **Key Value**: Eliminates credential sharing and insecure user dropdowns, prevents brute-force account enumeration, and provides rapid sub-second access while upholding zero-trust enterprise security standards.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Biometric Enrollment Flow (Inside User Profile)**:
   - User navigates to **My Profile** > **Fingerprint Password (Alama ya Kidole)**.
   - If device does not support WebAuthn platform authenticators, an informative status note explains that the current browser/device lacks hardware biometric support.
   - User clicks **Setup Fingerprint Password**. A modal prompts for their existing account password to authorize registration.
   - The system triggers `navigator.credentials.create(...)` with `userVerification: 'required'` and `residentKey: 'required'`.
   - The operating system displays its native biometric prompt (e.g., "Use Touch ID" or "Windows Hello").
   - Upon successful biometric touch, the credential ID is linked to the user account in persistent storage. If cancelled or sensor fails, registration is aborted with an explanatory notification.
   - The profile immediately displays **Enrolled & Active** with timestamp and options to **Test Fingerprint Unlock**, **Re-Scan / Update**, or **Disable Fingerprint**.

2. **Biometric Sign In Flow (On Login Screen)**:
   - If the device has no enrolled biometric credentials, the login screen displays only the standard secure username and password fields.
   - If an enrolled passkey exists on the device, a subtle, elegant **Sign In with Fingerprint / Passkey** button appears below the form.
   - Clicking triggers the native OS biometric prompt immediately (`navigator.credentials.get(...)`).
   - The user places their finger on their device sensor.
   - The authenticator returns the discoverable credential assertion containing the registered user handle.
   - TradeCore verifies the credential against the enrolled account, verifies that the account is active/not blocked, and logs the user directly into their dashboard with a security audit trail.
   - If the user cancels the sensor prompt or biometric fails, an explicit warning is displayed and the modal closes back to the standard password form.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TradeCore ERP Sign In                           │
│                                                                        │
│   Username: [ cashier1                                  ]              │
│   Password: [ ••••••••••                                ]              │
│                                                                        │
│   [                 Sign In with Password              ]               │
│                                                                        │
│   ─────────── Or (Only shown if device enrolled) ──────────            │
│                                                                        │
│   [ 🖿  Sign In with Fingerprint / Passkey              ]               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Visual Identity & Styling
- **Aesthetic Direction**: Clean, high-density enterprise fintech style adhering to the 60-30-10 color rule and Zero-Pill discipline.
- **Palette**: Deep slate backgrounds, crisp white cards, hairline 1px borders (`border-slate-200 dark:border-slate-800`), with emerald accents (`#059669` / `#10B981`) dedicated exclusively to verified biometric hardware states.
- **Zero-Pill Compliance**: Enrolled timestamps and security metadata will be displayed as unboxed text with `·` separators, avoiding colored capsule badges.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Elimination of Public Account Dropdown**
  - *Chosen Approach*: Rely entirely on WebAuthn discoverable credentials (`residentKey: 'required'`).
  - *Why*: The previous "Select Enrolled Account" dropdown exposed all usernames, roles, and names to unauthenticated users and allowed anyone to click another person's name. Discoverable credentials let the physical hardware sensor identify the authentic user cryptographically.
  - *Alternatives Considered*: Username-first prompt (requiring typing username before touching sensor). Discoverable credentials provide superior speed without sacrificing security.

- **Decision 2: Strict Hardware Verification (No Simulated Bypass)**
  - *Chosen Approach*: If `navigator.credentials.get` or `create` throws an error or is cancelled, abort immediately and notify the user.
  - *Why*: The previous timer simulation (`setTimeout` to 100%) allowed logging in even without touching the sensor or having hardware. Security requires genuine hardware verification.
  - *Alternatives Considered*: Allowing fallback timer for development testing. Rejected because security integrity requires that fake bypasses never reach production code.

- **Decision 3: Device-Aware Sign-In Button Visibility**
  - *Chosen Approach*: Check `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` and query local storage for enrolled passkeys on the current browser instance before rendering the biometric sign-in button.
  - *Why*: Avoids cluttering the login screen with useless or confusing buttons on devices without fingerprint sensors or on devices where no user has enrolled.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Architecture Flow                                    │
│                                                                                        │
│   [ Profile Panel ]                                                                    │
│          │                                                                             │
│          ▼                                                                             │
│   Authorize Password ──► navigator.credentials.create() ──► OS Biometric (Touch ID/Hello)
│                                  │                                  │                  │
│                                  ▼                                  ▼                  │
│                        Extract Credential ID              Store in Users & Device Map  │
│                                                                                        │
│   [ Login Screen ]                                                                     │
│          │                                                                             │
│          ▼                                                                             │
│   Check Device Enrollment ──► navigator.credentials.get() ──► OS Biometric Match       │
│                                  │                                  │                  │
│                                  ▼                                  ▼                  │
│                        Lookup User by Credential ID       Authenticate & Enter Session │
│                                  │                                                     │
│                        (If Failed/Cancelled) ──► Strict Error Alert & Abort            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Core Components & Modules

1. **`src/utils/webauthn.ts`** (New Dedicated Utility):
   - `isWebAuthnAvailable()`: Checks `window.PublicKeyCredential` and `isUserVerifyingPlatformAuthenticatorAvailable()`.
   - `registerBiometricCredential(user)`: Generates cryptographically secure challenge, issues `credentials.create()`, base64-encodes credential ID, and returns payload.
   - `authenticateBiometricCredential()`: Issues `credentials.get()` with `userVerification: 'required'`, retrieves matched credential ID.
   - `hasEnrolledCredentials()`: Fast synchronous check for locally registered passkeys on the client.

2. **`src/components/Profile.tsx`**:
   - Replaces mock progress timer with genuine `registerBiometricCredential()` and `authenticateBiometricCredential()`.
   - Updates `currentUser` and `users` with `fingerprintEnabled: true`, `fingerprintCredentialId`, and `fingerprintRegisteredAt`.
   - Re-scan and Test Unlock utilize real WebAuthn calls.

3. **`src/App.tsx` (Login Screen & Auth Lifecycle)**:
   - Removes public account selection list from the biometric modal.
   - Condition-gates `Sign In with Fingerprint / Passkey` button so it only appears when enrolled credentials exist on the device.
   - `handleExecuteBiometricScan`: Runs real `authenticateBiometricCredential()`. If successful, resolves user by matched credential ID and logs in. If rejected or cancelled, logs security audit trail and halts.
