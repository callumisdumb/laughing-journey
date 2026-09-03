# Security architecture

How Person360 encrypts what it holds, who holds which key, what rotation and recovery do, and what the design does not protect. Written for an information governance lead, a Caldicott guardian and a security reviewer as much as for an engineer.

Read `docs/THREAT-MODEL.md` first: it says what the design defends against and ranks the adversaries. This document says how. `docs/CRYPTO-INVENTORY.md` is generated from the code and lists every algorithm and parameter. `docs/DPIA-NOTES.md` maps all of it to UK GDPR Article 32.

## 1. The claim, and the sentence that does the work

**Record content is end-to-end encrypted. The product as a whole is not, and no screen in it says otherwise.**

The instruction behind this work was "ensure that everything is end-to-end encrypted". That instruction cannot be met literally by a multi-agency safeguarding platform, for reasons set out in the threat model: the controller has statutory duties that require plaintext, the regulator treats inaccessibility as a security failure in its own right, and encrypting everything to one organisational key would defend against a stolen backup and nothing else.

So the design was reframed rather than watered down:

> The product does not encrypt everything to one key. It encrypts every record to exactly the set of people entitled to see it.

The need-to-know matrix stops being a rule a server chooses to honour and becomes a fact about who holds which key. That is a stronger claim than the literal one for the breaches that actually happen in this sector, and it is one the code can support. Section 8 lists what it costs.

## 2. Key hierarchy

Six kinds of key. Each row of the diagram wraps the row below it, so a key is only ever at rest inside something that already required a key to open.

```
                          ┌───────────────────────────┐
                          │  escrow key (2 of 5)      │
                          │  Shamir over GF(256)      │
                          │  five holders, five orgs  │
                          └────────────┬──────────────┘
                                       │ wrapped as a recipient of every record
                                       │ (statutory disclosure, break-glass, recovery)
                                       ▼
  device key ──wraps──▶ user key ──wraps──▶ role key ──┐
  (OS keychain,         (stable identity,   (one per     │
   one per machine)      survives a new      role per    ├──wraps──▶ case key
                         laptop)             agency)     │           (one per process
                                                         │            instance)
                        agency key ─────────────────────┘                │
                        (material shared with an agency,                 │ wrapped to
                         not a named person)                             │ every entitled
                                                                         │ principal
                                                                         ▼
                                                          ┌──────────────────────────┐
                                                          │  content key, per record │
                                                          │  AES-256-GCM, fresh on   │
                                                          │  every write             │
                                                          └──────────────────────────┘
```

| Kind | What it is for | Where the private half lives | Rotated |
|---|---|---|---|
| device | One per user per machine. The root of trust on that machine. | OS keychain: Tauri's keyring plugin, Electron's `safeStorage`. In a browser, `localStorage`, which the interface says out loud. | On enrolment. Revoked by the user, on loss, or on departure. |
| user | The person's stable identity, so enrolling a second laptop does not rewrap every record they can read. | Wrapped to each of that user's enrolled device keys. | On suspected compromise and on departure. |
| role | One per role per agency, so a rota holds the key for as long as it holds the role rather than for as long as a person is in post. | Wrapped to each current member's user key. | On every membership change. |
| agency | Material addressed to an agency rather than to a named person: an unclaimed research request, an inbound connector event before it is routed. | Wrapped to that agency's role keys. | Scheduled. |
| case | One per process instance. This is the join between the need-to-know matrix and the cryptography. | Wrapped to each entitled user, role or agency key. | On removal of a principal, on a schedule, and on suspected compromise. |
| escrow | Statutory disclosure, break-glass and recovery. | Split two of five across five organisations. Software shares in this mockup; hardware security module backed in production. | Scheduled, and on any holder's departure. |

The important line is the last-but-one. A case key is wrapped to the principals the resolver returns, and the resolver returns a wrapping list rather than a permission boolean (section 4). There is no path in the code from an entitlement decision to visible content that does not run through an unwrap, and a test walks every source file in `apps/web` and `packages/domain` to prove no caller has quietly reintroduced one.

## 3. The suite

One suite, named in every ciphertext and every key record: `v1-x25519-mlkem768-aes256gcm`.

| Layer | Primitive | Why |
|---|---|---|
| Content | AES-256-GCM, 96-bit nonce generated by the sealing function | Authenticated, fast, universally reviewed. `seal` generates its own nonce and offers no way to supply one, because a reused nonce is the failure mode that destroys GCM. |
| Key establishment | X25519 and ML-KEM-768, both shared secrets fed into HKDF-SHA-256 | Hybrid, so the result holds if either component holds. ML-KEM is not used alone, which is the NCSC's transitional posture and also covers an implementation flaw in the newer primitive. |
| Key derivation | HKDF-SHA-256, one info string per purpose | A key derived for the local store cannot be used as a blind index key. Five purposes, five strings, listed in the inventory. |
| Signatures, short horizon | Ed25519 | Enrolment approvals, exports, ordinary audit entries. |
| Signatures, long horizon | ML-DSA-65 alongside Ed25519 | An audit entry or a meeting minute written in 2026 may need to verify in a Learning Review in 2050. |
| Passphrase stretching | Argon2id, 64 MiB, 3 passes, 4 lanes | Recovery. PBKDF2 and scrypt are refused by the build. |
| Integrity of the ledger | SHA-256 hash chain | Section 6. |
| Exact-match lookup | HMAC-SHA-256 blind index | Section 8, and it leaks equality, which is stated wherever it appears. |

**Nothing in this repository implements a primitive.** Everything comes from the @noble packages, which are audited, dependency-free and behave identically in WebKitGTK, WebView2, Chromium and Node. That last property is the reason they were preferred over WebCrypto alone: the two desktop shells and the browser are three different engines, and a product that behaved differently in the Tauri build than in the Electron one would be untestable (D-063).

Two details worth a reviewer's attention:

**The AAD binds a record to its own identity.** Every seal carries the record id, its classification and its generation as additional authenticated data, length-prefixed so one field cannot impersonate another. Moving a ciphertext from a routine record onto a restricted one, or replaying an old generation over a rotated record, fails to authenticate rather than silently succeeding.

**The wrapping key binds to the exact pairing.** The wrapping key is derived from both shared secrets together with the recipient's public key and the ephemeral public key, so a wrapped key lifted from one recipient's slot does not open under another's.

## 4. Entitlement is a key, not a boolean

The old resolver answered "may this user see this?" and the UI believed it. The new one answers "which principals does this record get wrapped to?", and the answer is used twice: once when the record is written, to build the wrapping list, and once when it is read, to find the wrap that opens.

`canSee` is gone. What replaced it is `accessRank`, which orders the levels for sorting and display and carries a comment saying it must never gate content. The rule is enforced by a test rather than by discipline: `vault.test.ts` reads every `.ts` and `.tsx` in `apps/web` and `packages/domain`, strips comments, and fails if anything calls `canRead(` or `canSee(`.

Principal identifiers are opaque and prefixed by kind (`p:usr:`, `p:rol:`, `p:agy:`, `p:cas:`, `p:esc:`). They are not names, email addresses or staff numbers, because they are visible to the operator (section 8).

Two deliberate omissions in the wrapping list:

- **Presence readers are excluded.** Someone entitled only to know that a record exists is not wrapped to it, because presence is metadata and metadata is what the operator sees anyway. Wrapping them would give them the content.
- **Escrow is always included.** Every record. That is the honest position: a record the escrow path cannot reach is a record the controller cannot produce on a sheriff's order, and section 2 of the threat model explains why that is not deployable.

## 5. Rotation, and the sentence the interface refuses to soften

`rotateRecord` generates a fresh content key, re-encrypts, and wraps to the new principal list. It returns `priorAccessRemains: true`, and that field is not decoration: it drives the copy shown at the point of removal.

**Removing someone from a case does not unread what they already read.** Rotation stops future access. It cannot retract a page someone has already opened, and it cannot retract a copy they made. The interface says this in those words, at the moment a chair removes a member, because a chair who believes removal retracts will make a different decision from one who knows it does not.

`addPrincipals` takes the reader's own private key, so extending access requires someone who can already open the record. There is no administrative widening.

`rewrapToSuite` exists so that a suite change is a supported operation rather than a migration script written under pressure. Decryption dispatches on the suite identifier found in the ciphertext, not on the one the code prefers, and `suiteCompat.test.ts` opens a committed fixture sealed on 03 September 2026 under the first suite. That fixture is never regenerated: a compatibility test that is regenerated whenever it fails is a test that tests nothing.

## 6. Audit is signed, not encrypted

Audit exists to be read by the people it polices: a Caldicott guardian, an Adult Protection Committee lead officer, an inspector, the ICO. Encrypting it to them would be backwards.

So each entry is signed with the actor's device key and carries the hash of its predecessor. Altering an entry breaks its own signature; removing one breaks the link of the entry after it. Verification walks from genesis and stops at the first break, because everything after a break is unverifiable anyway and a cascade of consequential failures buries the one that matters.

Actor, action, target identifier, classification and timestamp stay in the clear. **Only the free-text detail field is encrypted**, to a set of oversight roles, because that is the field where a practitioner might write something about a third party who is not the subject of the record.

The Admin verification screen has two buttons. One verifies the real ledger. The other verifies a deliberately tampered copy of it, edited the way somebody covering their tracks would edit it, by turning a restricted read into an ordinary one, and shows the break being found. A verification screen that has only ever said "verified" proves nothing: anyone can write a function that returns true.

## 7. Key management

### Enrolment

A new device generates its own key pair, and the private half never leaves the OS keychain. The public half is approved either by an existing device of the same user, or by two colleagues. Two rather than one, for the same reason escrow is split: one person should not be able to add a device to somebody else's account, whether through malice or through being talked into it on the phone. The device shows a fingerprint and the approver reads the same fingerprint back, so what is approved is a specific key rather than a request that arrived at the right moment. `enrolmentReady` refuses anything short of that.

### Escrow

Five holders, in five organisations with different lines of accountability: the MAPPA Coordinator, the Chief Social Work Officer, the health board Caldicott guardian, the police public protection superintendent and the Adult Protection Committee lead officer. Two must act, **and `escrowDecision` refuses two holders from the same organisation** rather than leaving it to policy, because policy is not what runs at two in the morning.

Every use records a purpose from a fixed list, a lawful basis and a written reason, produces an audit entry signed by both holders so neither can later say they were not there, and notifies the remaining three.

Break-glass used to be procedural: a dialog, a reason, a four-hour grant and a server that honoured it. Making it cryptographic means it now takes two humans in two organisations and cannot be done quietly by one administrator with database access.

### Recovery

Someone who has lost every device has lost their user key, and no amount of good intentions gets it back from the keychain of a laptop at the bottom of a canal. Two paths, both real:

1. **A recovery passphrase**, stretched with Argon2id, wrapping a copy of the user key. It is generated at enrolment, shown once, and the copy is stored with its salt beside the wrapped key. This is the path that does not need anybody else.
2. **Escrow**, when the passphrase is gone too. `recoveryEscrowRequest` builds an ordinary escrow request with the recovery purpose, so it takes the same two holders in two organisations and produces the same signed, notified audit entry. Recovery is not a quieter door than disclosure.

### Offline

The desktop shells work offline, which is not optional: a social worker in a house with no signal is the normal case, not the edge case. Wrapped keys are cached locally, sealed under the device key, and stay valid for a grace period seeded at 72 hours.

The grace period is the trade in plain sight. Shorter, and a practitioner is locked out at three in the morning. Longer, and a device stolen while unlocked keeps its cached cases for longer. 72 hours is the seeded compromise, it is configuration, and the interface shows the remaining validity rather than failing without explanation when it expires.

### Leavers

`leaverPlan` produces the ordered list, and it is ordered because the order matters: revoke every device first, then rotate every case key the person held, then their role keys, then rewrap. Their audit entries stay and stay verifiable, because a leaver's history is exactly what a Learning Review needs, and because deleting the entries of a person who has left is how an organisation loses the ability to answer a question about them.

## 8. What this costs, without softening

This section repeats section 4 and section 7 of `docs/THREAT-MODEL.md`. It is repeated rather than cross-referenced because a limitations section that lives only in another document is a limitations section nobody reads.

### 8.1 Metadata is visible to the operator

With every defence working as designed, an adversary with full storage access still sees:

| Visible | What it lets them infer |
|---|---|
| Record identifiers | How many records exist, and their creation order |
| Identifiers of wrapped-key holders | How many principals can read a record, and which records share a reader |
| Record type, coarsely | That a MAPPA record exists, as distinct from an ASP one |
| Classification | Which records are Official-Sensitive |
| Timestamps, bucketed to the day | Roughly when activity happens |
| The existence of a link between records | That two records concern related matters |

Four things keep it small: principal identifiers are opaque and rotated, record types are coarse ("MAPPA process", never "MAPPA Level 3 review with disclosure decision"), timestamps on the most sensitive types are bucketed to the day, and presence is the designed leak, which is a concept the need-to-know model already has and practitioners already understand.

This table is on the "What the host can see" screen in Admin and on the Security page in Help, with the real values, not a sanitised version.

### 8.2 Search

A server that cannot read cannot index. Search is a client-side inverted index over the records the signed-in user can decrypt, built at sign-in, and it reports how many records it covered and how many it could not.

A blind index (HMAC-SHA-256 under a client-held key) supports exact-match lookup on reference numbers and on dates of birth bucketed to the month. **It reveals equality**, so an operator holding the tags learns which records share a value and can mount a frequency attack on a low-entropy field. Dates of birth are bucketed for that reason and **names are excluded entirely**.

Encrypted search is not solved here and nothing in the product claims it is. Searchable symmetric encryption schemes with better properties exist, and every one of them leaks something; naming the trade-off is worth more than a scheme nobody on the buying side can evaluate.

### 8.3 Connectors

At the moment data arrives from EMIS Web, ECLIPSE, iVPD or SEEMIS there is no client, so there is nothing to encrypt on. The answer is to move the encryption to where the data already is: a gateway deployed inside the agency's own network, holding that agency's key, which pulls, maps, encrypts and pushes ciphertext.

The half that matters most to an NHS information governance lead is the second one. The reason these integrations are hard to approve is rarely the data flowing out; it is being asked to hand a supplier a service account on EMIS Web. Credentials stay in the gateway and never reach the platform.

In the mockup the boundary is structural rather than deployed: the mock adapters run gateway-side and a test asserts the mock API receives only ciphertext.

### 8.4 Statutory returns

Counting a caseload needs the caseload. Returns are computed client-side in the session of the person entitled to the whole of it, which is the Adult Protection Committee lead officer or the MAPPA Coordinator. The person producing the return is precisely the person with lawful access to what it counts, which is a better arrangement than a server that could do it, not a worse one.

### 8.5 The residual risks, collected

1. **Two colluding escrow holders can read anything.** Governance, not cryptography. Raising the threshold trades against availability in exactly the way section 7 describes. The holders sit in five organisations with different accountability precisely because there is no cryptographic answer to collusion at the threshold.
2. **A compromised practitioner account sees that practitioner's entitlements.** So does a practitioner who is legitimately on a case and misuses what they see. Cryptography prevents access; it does not prevent misuse by someone entitled to access, and the Security page in Help says so in those words.
3. **Metadata is visible to the operator** (8.1).
4. **A blind index reveals equality** (8.2).
5. **A device stolen while unlocked keeps cached access** until the offline grace period expires.
6. **Removing someone from a case cannot unread what they already saw** (section 5).
7. **The controller can reach any record** through escrow. By design, and the reason the product is lawful to deploy.
8. **Hardware security module backing for escrow shares is not implemented** in this mockup. Software shares only. Noted so nobody mistakes the demonstration for the deployment.

## 9. What this mockup actually builds, and what it represents

The distinction is drawn here rather than left for a reader to work out, because a demonstration that blurs it is how an overclaim gets into a procurement document.

**Real, running in the mockup.** The whole of `packages/crypto`: AEAD, hybrid wrapping, HKDF, signatures, Shamir, the hash chain, with known-answer vectors from RFC 7748, RFC 8032, RFC 5869, FIPS 180-4 and NIST CAVP. Every process record in the seed is genuinely encrypted and genuinely unwrapped before display. The local store is genuinely sealed at rest. The audit chain genuinely verifies and a tampered copy genuinely fails. Escrow genuinely splits and recombines, and genuinely refuses two holders from one organisation.

**Represented, not deployed.** Transport security, because there is no transport: the product is a static export with a mock API in the same process. Hardware security module backing for escrow shares. The connector gateway as a separately deployed component, though the encryption boundary it implies is structural in the code. Key rotation on a schedule, as opposed to on demand, since there is no scheduler in a mockup with no backend.

**Not present at all.** No server, no network, no telemetry. The threat model's server-side adversaries are reasoned about rather than tested against, and the "What the host can see" screen renders from the same in-memory store the rest of the product uses, which is what makes it honest: the left panel reads only the metadata a server would hold, and the right panel needs a key.

## 10. Honesty rules for the interface

These are rules for anyone adding a screen, not a description of screens that exist.

1. **Never write "end-to-end encrypted" without saying what is and is not covered.** The Security page in Help has a section headed "What is not encrypted" and it comes second, before the reassuring material rather than after it.
2. **A padlock means content is sealed to a key list. It never means "safe".** No screen implies that encryption prevents a colleague on the case from misusing what they see.
3. **Where a defence is partial, the copy says partial.** The offline grace period shows its remaining validity. The blind index says it reveals equality. The escrow section says two holders can reach anything.
4. **The Security page answers the questions people actually ask**, in their words: what is encrypted, what is not, who can see my record, what happens if I lose my laptop, can the supplier read this, why can a colleague still look me up, why is search different, what happens offline.
5. **No claim in the interface may exceed section 8.** If a screen would need a stronger sentence than this document supports, the sentence is wrong, not the document.

## Related

- `docs/THREAT-MODEL.md`: the adversaries, ranked, and what each defence does and does not do.
- `docs/CRYPTO-INVENTORY.md`: generated from the code. The NCSC's 2028 discovery deliverable.
- `docs/DPIA-NOTES.md`: UK GDPR Article 32, and the Article 34(3)(a) position on breach communication.
- `docs/NEED-TO-KNOW.md`: the matrices the wrapping lists are built from.
