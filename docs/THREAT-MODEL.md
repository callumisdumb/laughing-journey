# Threat model

Person360 holds child protection, adult support and protection, domestic abuse and MAPPA records for a Scottish public protection partnership. This document says what the design defends against, what it partly defends against, and what it does not, with the reasoning for each. It is written to be read by an information governance lead, a Caldicott guardian and a security reviewer, not only by an engineer.

Nothing in this document claims more than the code does. Where a defence is partial it says partial and why. Where the design leaks something it says what.

## The claim, stated exactly

**Record content is end-to-end encrypted.** It is encrypted on the client under a per-record content key, and that key is wrapped only to the principals the need-to-know rules entitle. The platform operator holds no key that decrypts it.

**The product as a whole is not end-to-end encrypted, and no screen says it is.** Metadata is not encrypted (section 4). Audit is signed rather than encrypted, deliberately (section 5). The escrow path exists and can reach any record under split control (section 6). All three are design decisions, not gaps, and each is explained below.

## Why not literal end-to-end encryption

The instruction that produced this design was "ensure that everything is end-to-end encrypted". Taken literally that cannot be met here, and building towards it literally would produce something that fails its first security review and fails a practitioner at two in the morning. Four reasons, in order of how much they matter.

**Availability is a safety property, and the regulator treats losing it as a failure.** The ICO's encryption guidance is explicit that personal information becoming inaccessible through encryption will likely mean the organisation has not implemented appropriate security measures, and that it may itself constitute a personal data breach where the data becomes unavailable to the organisation. Its stated mitigation is centrally managed encryption. In safeguarding the stakes are higher than a regulatory finding: a social worker who cannot open an interim safety plan out of hours because a key is unavailable is a child protection incident. Key escrow is therefore part of the design, not a compromise of it.

**The controller has duties that require plaintext.** The council is the data controller. It must answer subject access requests, comply with sheriff court orders and disclosure requests, produce statutory returns, and give the Care Inspectorate and Healthcare Improvement Scotland the access their scrutiny functions require. A system whose operator genuinely cannot decrypt can do none of that, and would not be deployable.

**Server-side functions cannot run on ciphertext.** Search, need-to-know evaluation and notification routing, connector ingestion from EMIS Web and iVPD, and the statutory returns all assumed a server that can read. Section 4 says what happens to each.

**The naive reading solves the wrong problem.** Encrypting everything to one organisational key protects against a stolen backup and nothing else. The breaches that actually happen in Scottish public protection are the curious colleague looking up a neighbour, an agency reading a case it is not on, and an administrator with standing access to everything. Those are access control problems, and cryptography enforces access control far more strongly than a server-side permission check does.

So the design does not encrypt everything to one key. **It encrypts every record to exactly the set of people entitled to see it.** The need-to-know matrix stops being a rule the server chooses to honour and becomes a fact about who holds which key. That is a stronger and more honest claim than "end-to-end encrypted", and it is one this product can actually support.

## 1. Adversaries

Ranked by how often they occur in UK public sector safeguarding, not by how dramatic they sound.

### 1.1 The curious colleague, **full defence**

A member of staff with a legitimate account looking up a person they are not working with: a neighbour, an ex-partner, a celebrity, a family member. This is the most common real breach in this sector, it is what most audit trails exist to catch, and it is the one that ends careers and reaches the ICO.

The content key of every record is wrapped only to entitled principals. An unentitled colleague holds no wrapped key, so there is no decryption to attempt and nothing to look up. They see what the presence level already allows: that a record exists, and nothing about it.

This is the headline defence and the one worth demonstrating first. It converts the most common breach from "detected afterwards by audit" to "not possible".

**Residual risk.** A colleague who is legitimately on the case sees everything on it, and cryptography cannot help with that. See 1.8.

### 1.2 The unentitled agency, **full defence**

A partner agency on the platform reading a case it is not party to: housing reading a MAPPA record, education reading an adult protection inquiry.

The same mechanism. Agency and role keys are wrapped per case, so an agency not on a case holds nothing that opens it. This matters more than 1.1 to the partners: an NHS board's information governance lead will not sign an information sharing agreement on the strength of a supplier's promise that the permission check works.

### 1.3 The platform or database administrator, **full defence for content, partial for metadata**

Someone with standing access to storage: a supplier's DBA, an operations engineer, a support contractor.

They see ciphertext. No administrative key decrypts record content, because no such key exists: the escrow key is split across five holders in five organisations (section 6) and its use is audited and notified.

They do see metadata, and that is a real leak. Section 4 names exactly what.

### 1.4 The hosting provider, **full defence for content, partial for metadata**

Cloud operator, hypervisor, backup infrastructure, anyone with access to the machine rather than the account. Identical to 1.3 in what they can and cannot see.

This is the classic end-to-end encryption argument, and here it has a specific commercial consequence: it is what makes cloud hosting acceptable for material a health board would otherwise insist stays on premises. The "What the host can see" screen in Admin exists to make this inspectable rather than asserted.

### 1.5 Exfiltration of the database or a backup, **full defence for content**

A copied backup, a misconfigured bucket, a ransomware operator taking a copy on the way through.

Content is unintelligible without keys that are not in the database. This engages Article 34(3)(a) of the UK GDPR: the obligation to communicate a personal data breach to the data subjects does not apply where the controller has implemented measures that render the personal data unintelligible to any person not authorised to access it, and encryption is the named example.

**It does not remove the Article 33 obligation to notify the ICO.** The ICO's position is that the loss of an encrypted dataset may still involve a risk, particularly to availability, and the notification assessment is made on its own facts. Anyone reading this document should not take the encryption as a reason not to notify.

### 1.6 A lost or stolen device, **full defence with a bounded window**

A laptop left on a train, a phone taken from a car.

Device private keys live in the OS keychain (Tauri's keyring plugin, Electron's `safeStorage`), which binds them to the OS user account and, on most platforms, to hardware. The local store is encrypted at rest under the device key. Any user can revoke their own device immediately from Settings, and revocation stops the device fetching anything new.

**Residual risk.** Wrapped keys are cached locally for the offline grace period, seeded at 72 hours (section 5.4 of the task, implemented in the key manager). A device stolen while unlocked, or unlocked by an attacker who also has the OS credentials, retains access to already-cached cases until the grace period expires. Shortening the grace period reduces this window and increases the chance of a practitioner being locked out at three in the morning; 72 hours is the seeded compromise and it is configurable.

### 1.7 Harvest now, decrypt later, **full defence**

An adversary capturing ciphertext today and decrypting it when a cryptographically relevant quantum computer exists.

For most systems this is theoretical, because most data loses value quickly: a session cookie captured today is worthless in 2040. Safeguarding records are the opposite. A child protection record created in 2026 concerning a seven year old may still cause serious harm if disclosed in 2070. Records in this domain have lifespans measured in decades, and the archival duty means the ciphertext will still exist.

Key establishment is therefore hybrid from the first line of code: X25519 and ML-KEM-768 shared secrets are both fed into HKDF, so the result holds if either component holds. ML-KEM is not used alone, which is the NCSC's expected transitional posture and also protects against an implementation flaw in the newer primitive.

This is one of the few application domains where paying the hybrid overhead today is straightforwardly correct rather than precautionary.

### 1.8 A compromised practitioner account, **partial defence only**

An attacker with a practitioner's device and credentials holds that practitioner's keys and sees exactly what they see.

Cryptography does not help here and this document does not pretend otherwise. The mitigation is scope and detection, not maths:

- The compromised account sees only that user's entitlements, which for most practitioners is a handful of cases rather than a caseload.
- Every read is audited, and every restricted read is audited separately.
- Device revocation and key rotation are the response; the leavers flow does both.

**A practitioner legitimately on a case who misuses what they see is the same problem and has the same answer.** Cryptography prevents access; it does not prevent misuse by someone entitled to access. The Security page in Help says this in as many words, because a product that implied otherwise would be lying to the people relying on it.

### 1.9 A malicious or coerced insider with escrow authority, **partial defence**

A holder of an escrow share who wants to read something they are not entitled to, or who is pressured into it.

Defence is split control: the escrow key is shared two-of-five with Shamir's Secret Sharing, and the five holders are seeded in five different organisations (the MAPPA Coordinator, the Chief Social Work Officer, the health board Caldicott guardian, the police public protection superintendent and the Adult Protection Committee lead officer). One person cannot reconstruct it. Every use produces a signed audit entry naming both holders, and notifies the remaining three.

**Residual risk, stated without hedging: two colluding holders can read anything.** That is a governance control, not a cryptographic one, and it is the reason the holders sit across five organisations with different lines of accountability rather than five people in one council. There is no cryptographic answer to collusion at the threshold; raising the threshold trades against availability in exactly the way section 1.6 describes.

## 2. Explicitly out of scope

**The council as data controller is not an adversary.** The design assumes the controller can, through a governed and audited escrow path, reach any record it is legally obliged to produce: a subject access request, a sheriff court order, a Care Inspectorate scrutiny function, a Learning Review.

This is deliberate, and anyone reading this document should understand why. A system that genuinely could not produce a record on a sheriff's order would not be lawful to deploy, and a system that could not answer a subject access request would put the controller in breach. The question a reviewer should ask is not "can the operator ever decrypt" but "what does it take, who has to agree, and is it recorded", and section 6 answers that.

**Transport security is out of scope of this mockup** because there is no transport: the product is a static export with a mock API in the same process. In production it is TLS 1.3 with certificate pinning between the client and the platform, and mutual TLS between the connector gateway and the platform.

**Hardware security module backing for escrow shares is a production requirement, not implemented here.** The mockup holds shares in software. Noted so nobody mistakes the demonstration for the deployment.

## 3. What an attacker learns even when every defence holds

An honest threat model names its leakage. With every defence above working as designed, an adversary with full storage access still learns:

| Visible | What it lets them infer |
|---|---|
| Record identifiers | How many records exist, and their creation order |
| Identifiers of wrapped-key holders | How many principals can read a record, and which records share a reader |
| Record type, coarsely | That a MAPPA record exists, distinct from an ASP one |
| Classification | Which records are Official-Sensitive |
| Timestamps, bucketed | Roughly when activity happens |
| The existence of a link between records | That two records concern related matters |

From that an operator can infer that *some* person has a MAPPA record, that a case exists between two opaque identifiers, and roughly when work happens on it. They cannot learn who the person is, what the record says, or which practitioner holds which case in the world outside the system.

Four things minimise it deliberately:

- **Principal identifiers are opaque and rotated.** Not names, not email addresses, not staff numbers.
- **Record types are coarse.** "MAPPA process" rather than "MAPPA Level 3 review with disclosure decision".
- **Timestamps are bucketed to the day**, not the second, so a burst of activity at three in the morning on a MAPPA record does not reveal an incident's timing. The bucketing is applied to every record rather than to a list of sensitive types, because a list is something somebody forgets to add to.
- **Presence is the designed leak.** The need-to-know model already has a presence level, which tells an unentitled party that a record exists and nothing more. That level is exactly what an operator sees, which means the leakage is a concept practitioners already understand rather than a new one.

This table is reproduced on the "What the host can see" screen in Admin and on the Security page in Help. The screen shows the real metadata, not a sanitised version: a demonstration that showed only ciphertext would be a lie, and the one person in the room who knows that is the one who needs convincing.

## 4. Functions the design costs, and what was done about each

| Function | Cost | Answer |
|---|---|---|
| Search | A server that cannot read cannot index | Client-side inverted index over the records the user can decrypt. A blind index (HMAC under a client-held key) for exact-match fields only: reference numbers and bucketed dates of birth, never names. |
| Need-to-know evaluation | Still runs server-side on metadata | The resolver's output changes from a permission boolean to a key-wrapping list, so entitlement and decryptability are the same fact. |
| Connector ingest | No client exists at ingest | An agency-hosted gateway holding the agency's key: it pulls from EMIS Web, iVPD, SEEMIS and the rest inside the agency's own network, maps, encrypts, and pushes ciphertext. The platform never sees plaintext, and the agency never hands the platform credentials to its clinical or policing systems. |
| Statutory returns | Counting needs the whole caseload | Computed client-side in the session of the person entitled to the whole caseload, which is the APC lead officer or the MAPPA Coordinator. The person producing the return is precisely the person with lawful access to what it counts. |
| Subject access and court orders | Require plaintext | The Statutory disclosure flow in Admin, through escrow, under split control, with a recorded lawful basis and a signed audit entry. |
| Notification routing | Needs to know who to tell | Runs on the wrapped-key list, which is metadata. This is part of the leakage in section 3. |

**Encrypted search is not solved here and this document does not claim it is.** Searchable symmetric encryption schemes with better properties exist and every one of them leaks something. A blind index reveals equality, so an operator can tell that two records share a value and can mount a frequency attack on a low-entropy field. That is why date of birth is bucketed and names are excluded entirely. Naming the trade-off is worth more than a scheme nobody on the buying side can evaluate.

## 5. Why audit is signed rather than encrypted

Audit exists to be read by a Caldicott guardian, an Adult Protection Committee lead officer, an inspector and, if it comes to it, the ICO. Encrypting it to the people it exists to police would be backwards.

So every entry is signed with the actor's device key and chained to its predecessor's hash, which makes the log append-only and tamper-evident: an entry cannot be altered or removed without breaking the chain, and the Admin verification screen walks it and reports the break. Actor, action, target identifier, classification and timestamp stay in plaintext. Only the free-text detail field is encrypted, to a set of oversight roles, because that is the field where a practitioner might record something about a third party.

Signatures on entries with a long verification horizon use ML-DSA-65 alongside Ed25519, for the reason in 1.7: an audit entry from 2026 may need to be verified in a Learning Review in 2050.

## 6. What it takes to reach a record through escrow

Set out plainly, because this is the part a reviewer should test.

1. Two of the five escrow share holders must act, and they must be in **different organisations**.
2. The action names a purpose from a fixed list: statutory disclosure, break-glass, or recovery.
3. It records a lawful basis, exactly as every other share in the product does.
4. It produces an audit entry signed by both holders, naming both.
5. The remaining three holders are notified.
6. For break-glass, the reconstructed key lives in memory for the existing four-hour window and no longer.

Break-glass was procedural in the earlier design: a dialog, a reason, a four-hour grant, and a server that honoured it. Making it cryptographic means it now requires two humans in two organisations and cannot be done silently by one administrator with database access. That is a genuine improvement rather than a restatement.

## 7. Residual risks, collected

Everything this design does not defend against, in one place, so nobody has to read for it.

1. **Two colluding escrow holders can read anything** (1.9). Governance, not cryptography.
2. **A compromised or misusing practitioner account sees that practitioner's entitlements** (1.8). Audit catches it afterwards; nothing prevents it.
3. **Metadata is visible to the operator** (section 3): record identifiers, key holder identifiers, coarse types, classification, bucketed timestamps, and the existence of links.
4. **A blind index reveals equality**, and a low-entropy indexed field is open to a frequency attack (section 4). Mitigated by bucketing and by excluding names.
5. **A device stolen while unlocked retains cached access for the remainder of the offline grace period** (1.6), seeded at 72 hours.
6. **The exclusion register is explicit, and the similarity check is a prompt rather than a guarantee.** A party who is not named in the referral, not derivable from a relationship record and not hand-recorded is excluded by nothing. Where a name is hand-recorded, matching it is exact: "Ryan Kerr" on the register does not match "Ryan James Kerr". A similarity check now blocks a near match behind an audited confirmation naming the entry it resembles, in both directions, but it is a warning layer and not the mechanism. The match was deliberately not made fuzzy: a fuzzy match that silently excludes the wrong person is its own failure, in a product whose whole point is that the register is a list somebody wrote down.
7. **In a browser the device private key is held in `localStorage`, where any script running in the page origin can read it.** The desktop shells hold it in the OS keychain, bound to the OS user account and, on most platforms, to hardware. There is no equivalent store in a browser, so any cross-site scripting flaw in the application reads the key and with it every wrapped key cached on that device. That is a materially different risk from the keychain path, not a smaller version of the same one. **The desktop shells are therefore the supported deployment and the browser build is for development and demonstration**, and the Security page in Help says so rather than leaving it in a table.
8. **Removing someone from a case cannot unread what they already saw.** Rotation stops future access only, and the interface says so in those words at the point of removal, because the alternative is a chair believing that removal retracts.
9. **The controller can reach any record** (section 2). By design, and the reason the product is lawful to deploy.
10. **Hardware security module backing for escrow shares is not implemented** in the mockup (section 2).

## Provenance

- ICO, "Encryption" guidance, on inaccessibility through encryption as a security failure and potentially a personal data breach, and centrally managed encryption as the mitigation. Read by the product owner on 03 September 2026.
- UK GDPR Article 34(3)(a), on the exemption from communicating a breach to data subjects where the data has been rendered unintelligible, with encryption as the named example; and Article 33, on notification to the supervisory authority, which is unaffected.
- NCSC, "Timelines for migration to post-quantum cryptography", published 20 March 2025: identify and plan to 2028, execute high-priority upgrades 2028 to 2031, complete migration 2031 to 2035. A discovery inventory is the 2028 deliverable, which is why `docs/CRYPTO-INVENTORY.md` is generated from the code rather than written by hand.
- MAPPA National Guidance (2022) Annex 2, for the classification scheme this design carries; see `docs/RESEARCH.md` 5.13.

See `docs/SECURITY.md` for the architecture and the key hierarchy, `docs/CRYPTO-INVENTORY.md` for the generated algorithm inventory, and `docs/DPIA-NOTES.md` for the mapping to UK GDPR Article 32.
