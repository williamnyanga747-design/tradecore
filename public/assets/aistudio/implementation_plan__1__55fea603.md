# WebAuthn Biometric Passkey Management & Dual-Option Login

Comprehensive implementation plan for hardware-based biometric passkey registration in user profiles (My Profile), opt-in/opt-out first-login flows, and adaptive dual-option login screens based on hardware availability and user enrollment status.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:
> - **Enrolled Passkey Management in My Profile**: Full management interface displaying active registered devices, creation and last-used timestamps, a "Register New Passkey" trigger, and instant revocation capability.
> - **Decline / Non-Enrollment Policy**: If a user does not accept biometric passkey enrollment or revokes all passkeys, the biometric login option is non-functional and automatically hidden from the login screen, presenting only standard password authentication.
> - **Device Hardware Screen Detection**: Live screen detection will probe `window.PublicKeyCredential` and `isUserVerifyingPlatformAuthenticatorAvailable()` to dynamically determine whether the user's current hardware screen supports fingerprint or Touch ID authentication.

---

### 1. Overview & Core Concept

- **What It Does**:
  Provides enterprise-grade biometric passkey lifecycle management for TradeCore ERP. Users can enroll hardware biometrics (Fingerprint sensors, Apple Touch ID, Windows Hello) either during first-login password initialization or anytime within **My Profile**.
  When a user accepts passkeys, they gain dual-option authentication (Password OR Fingerprint). When declined or revoked, biometrics are disabled and invisible, ensuring no friction or broken controls for non-biometric environments.

- **Target Audience / Persona**:
  All enterprise operators, cashiers, supervisors, and administrators using desktop, tablet, and mobile devices equipped with built-in biometric sensors.

- **Key Value**:
  Accelerates terminal entry from typing complex passwords down to a single touch (~500ms), while eliminating forgotten password delays and upholding strict zero-trust hardware identity verification.

---

### 2. User Experience & Visual Design

#### A. My Profile: Passkey & Hardware Security Panel (`src/components/Profile.tsx`)
1. **Hardware Detection Status Banner**:
   - Probes the device screen on mount.
   - If biometric sensor detected: displays a subtle emerald status banner with hardware badge: *"Platform Biometric Hardware Active (Touch ID / Fingerprint Ready)"*.
   - If not available: displays a muted slate notice explaining that this browser or screen lacks platform biometric hardware.
2. **Master Biometric Access Toggle**:
   - A clean switch: *"Enable Biometric Authentication for this account"*.
   - If toggled off, immediately revokes active login privilege for passkeys on this account.
3. **Register New Passkey Action**:
   - High-contrast, single-line action button: `[Fingerprint Icon] Register New Passkey`.
   - Triggers the browser's native platform authenticator prompt.
   - Prompts an optional device nickname (e.g., *"Workstation Fingerprint"*, *"Warehouse Tablet Touch ID"*).
4. **Enrolled Passkeys & Device List**:
   - Clean tabular/card list showing:
     - Device Label & Icon (Mobile, Laptop, Desktop).
     - Registration Date & Last Active Timestamp (`font-mono tabular-nums`).
     - Credential ID preview (`font-mono text-xs`).
     - Red text/icon action: `Revoke` with instant confirmation toast.

#### B. First-Login Password Change Flow (`src/App.tsx`)
1. When a user logs in for the first time or is required to reset their default password:
   - Form presents New Password and Confirm Password.
   - An explicit choice card: *"Biometric Hardware Passkey"*.
   - Clear radio/checkbox toggle with dual options:
     - **Accept (Recommended)**: *"Register and enable Fingerprint / Touch ID for quick 1-touch sign-in and password recovery."*
     - **Decline**: *"Password only — do not enable biometric hardware."*
   - If the user declines, the system sets `hasBiometrics: false` and `biometricEnabled: false`. The fingerprint sensor is never invoked, and the user enters the system immediately.
   - If accepted, the native biometric enrollment prompt is presented. Upon scan, the credential is saved and activated.

#### C. Adaptive Login Screen (`src/App.tsx`)
1. **Hardware & Enrollment Inspection**:
   - On screen load, checks if platform biometrics are supported.
   - When a username is typed or remembered: checks if that user has active enrolled passkeys and `biometricEnabled !== false`.
2. **Dual-Option Presentation (When Accepted & Hardware Available)**:
   - Primary: *"Authorize Entry"* (Password form).
   - Secondary / Quick: *"Sign in with Fingerprint / Passkey"* button with prominent fingerprint icon.
3. **Password-Only Presentation (When Declined or Hardware Unavailable)**:
   - If the user declined or revoked biometrics, or if the device has no sensor, the biometric button is completely omitted.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side WebAuthn Hardware Credential Storage with User Profile Synchronization**
  - *Chosen Approach*: Store cryptographic credential IDs and device metadata locally in persistent storage synchronized with the user profile (`currentUser.biometricPasskeys`, `currentUser.hasBiometrics`, `currentUser.biometricEnabled`).
  - *Why*: Enables instant local hardware recognition before backend roundtrips while keeping multi-device state coherent.
  - *Alternatives Considered*: Server-only storage requiring online server-side WebAuthn challenge generation for every touch, which stalls offline cashiers.

- **Decision 2: Strict Declination & Revocation State**
  - *Chosen Approach*: When a user unchecks enrollment or revokes their passkeys, `biometricEnabled` is explicitly set to `false`. The login view checks this flag and suppresses all biometric prompts for that account.
  - *Why*: Respects user autonomy and prevents unwanted hardware prompts on shared kiosks.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TradeCore Security Flow                            │
└─────────────────────────────────────────────────────────────────────────────┘

    First-Time Login Flow:
    ┌─────────────────────────┐
    │  Force Password Change  │
    └───────────┬─────────────┘
                │
                ├────── User Accepts ────► [registerBiometricPasskey()] ──► hasBiometrics: true
                │                                                           biometricEnabled: true
                └────── User Declines ───► hasBiometrics: false
                                           biometricEnabled: false

    My Profile Passkey Manager:
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  • Probe isPlatformBiometricAvailable()                                 │
    │  • [Register Passkey] Button                                            │
    │  • Active Devices Table: [Device Name | Enrolled At | Last Used | Revoke]│
    │  • Master Toggle: Enable / Disable Biometric Login                      │
    └─────────────────────────────────────────────────────────────────────────┘

    Login Screen Presentation:
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  If (hardwareAvailable && userHasActivePasskeys && biometricEnabled)     │
    │  ├── Option 1: Standard Password Submit ("Authorize Entry")             │
    │  └── Option 2: WebAuthn Hardware Scan ("Sign in with Fingerprint")      │
    │                                                                         │
    │  Else (Declined / Revoked / No Hardware)                                │
    │  └── Option 1 ONLY: Standard Password Submit ("Authorize Entry")        │
    └─────────────────────────────────────────────────────────────────────────┘
```

#### Key Data Structure Extensions (`src/types.ts` & `src/utils/webauthn.ts`)
- **`User` model**:
  - `hasBiometrics?: boolean`
  - `biometricEnabled?: boolean`
  - `biometricPasskeys?: UserBiometricPasskey[]`
- **Passkey utility functions**:
  - `isPlatformBiometricAvailable(): Promise<boolean>`
  - `registerBiometricPasskey(user, deviceName?): Promise<Result>`
  - `verifyBiometricPasskey(username?): Promise<Result>`
  - `revokeBiometricPasskey(passkeyId: string): boolean`
  - `revokeAllPasskeysForUser(userId: number): boolean`
  - `setAccountBiometricsActive(userId: number, enabled: boolean): boolean`

---

### 5. Implementation Phases (Execution Turn)

1. **Phase 1: Passkey Utility Extensions (`src/utils/webauthn.ts`)**:
   - Add `revokeBiometricPasskey`, `revokeAllPasskeysForUser`, and `setAccountBiometricsActive`.
   - Update `hasBiometricEnrolled` to verify `biometricEnabled !== false`.
2. **Phase 2: My Profile Passkey Section (`src/components/Profile.tsx`)**:
   - Add biometric hardware detection hook (`isPlatformBiometricAvailable`).
   - Add passkey registration card with device nickname input.
   - Add enrolled device table with live timestamps and revocation buttons.
   - Wire state persistence back through `saveAllData` and `currentUser`.
3. **Phase 3: First-Login Explicit Accept / Decline Logic (`src/App.tsx`)**:
   - Update `showForcePasswordModal` to provide an explicit Accept / Decline choice.
   - Respect user choice: if declined, persist `hasBiometrics: false` and `biometricEnabled: false`.
4. **Phase 4: Adaptive Dual-Option Login Screen (`src/App.tsx`)**:
   - Dynamically hide the fingerprint button when the target user or system has no active passkeys or user declined.
   - Show both options seamlessly when enrolled.
5. **Phase 5: Verification**:
   - Co-execute `compile_applet` and `lint_applet` together to verify 0 errors.
   - Verify dev server on port 3000.
