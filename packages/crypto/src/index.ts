/**
 * @mas/crypto: the cryptographic core of Person360.
 *
 * Pure functions, no UI, no storage, no side effects beyond reading the platform CSPRNG. Everything
 * that decides *who* may read something lives in @mas/domain; everything that makes that decision a
 * mathematical fact rather than a policy the server chooses to honour lives here.
 *
 * Read docs/THREAT-MODEL.md before changing anything in this package. It says what each piece is for
 * and, more importantly, what it does not defend against.
 *
 * No primitive is implemented here. AES-GCM, X25519, Ed25519, HKDF, SHA-256, ML-KEM-768, ML-DSA-65
 * and Argon2id all come from the audited @noble packages, which are dependency-free, pure TypeScript
 * and behave identically in WebKitGTK, WebView2, Chromium and Node. That last property is why they
 * were chosen over WebCrypto alone: the desktop shells run three different engines and a suite that
 * diverged between them would produce records one shell could not open (D-063).
 */
export * from './suite';
export * from './bytes';
export * from './keys';
export * from './aead';
export * from './wrap';
export * from './sign';
export * from './shamir';
export * from './kdf';
export * from './record';
export * from './chain';
