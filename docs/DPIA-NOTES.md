# DPIA notes: the security measures, mapped

**This is not a Data Protection Impact Assessment.** A DPIA is the controller's document, it covers necessity and proportionality, consultation and the risks to individuals, and most of it is nothing to do with engineering. This file is the part the engineering can supply: what the technical measures are, which obligation each one answers, and where each one stops.

It exists so that a data protection officer writing the real DPIA does not have to read the code, and so that the claims made to them can be checked against `docs/SECURITY.md` and `docs/THREAT-MODEL.md` rather than taken on trust.

Person360 is a mockup with no backend, so nothing here is a statement about a deployed system. Where a measure is represented rather than built, it says so, and section 6 lists those separately.

## 1. What is being processed, and why the bar is high

The record store holds child protection, adult support and protection, domestic abuse and MAPPA material for a multi-agency partnership. In UK GDPR terms that means:

- **Article 9 special category data** throughout: health, including mental health and capacity; sex life and sexual orientation, in MARAC and MAPPA material; racial or ethnic origin, collected for the ASP national return.
- **Article 10 data** relating to criminal convictions and offences, in the MAPPA and MARAC records.
- Data about **children**, who Recital 38 singles out as meriting specific protection.
- Data about **adults at risk**, whose ability to exercise their own rights may be exactly what is in question.

Article 32 requires measures appropriate to the risk. The risk here is at the top of the range: a disclosure from this store can put a person in physical danger from a named individual who is already known to be dangerous to them. That is the standard the measures below are set against, and it is why the design goes further than a permission check.

Processing runs under more than one regime. The council and the health board process under the UK GDPR and Part 2 of the Data Protection Act 2018; Police Scotland's processing for law enforcement purposes falls under Part 3. The lawful bases and the Schedule 1 conditions are the controller's to state in the DPIA. `TODO(verify)`: the Part 3 boundary for material a police officer contributes to a shared multi-agency record has a real answer and this repository does not assert one.

## 2. Article 32(1)(a): pseudonymisation and encryption

Article 32(1)(a) names encryption as an example measure, not as a requirement, and appropriateness is judged against the risk. Here it is used as the enforcement mechanism for access control rather than only as protection for data at rest.

| Measure | Where |
|---|---|
| Record content encrypted with AES-256-GCM under a per-record content key, generated fresh on every write | `packages/crypto/src/record.ts` |
| The content key wrapped only to the principals the need-to-know rules entitle. The platform operator holds no key that decrypts content. | `packages/domain/src/permissions/principals.ts`, `apps/web/lib/vault.ts` |
| Key establishment hybrid: X25519 and ML-KEM-768 shared secrets both fed into HKDF-SHA-256 | `packages/crypto/src/wrap.ts` |
| Additional authenticated data binds each ciphertext to its record id, classification and generation | `packages/crypto/src/aead.ts` |
| The local store on the device sealed under a device key held in the OS keychain | `apps/web/lib/localStore.ts` |
| Audit free-text detail encrypted to oversight roles; the rest of the entry left readable on purpose (section 4) | `apps/web/lib/auditChain.ts` |
| Principal identifiers opaque and prefixed by kind, never names, email addresses or staff numbers | `packages/domain/src/permissions/principals.ts` |
| Dates of birth in the blind index bucketed to the month; names never indexed | `apps/web/lib/clientSearch.ts` |

The last three are pseudonymisation measures rather than encryption ones, and they are the ones that limit what remains visible after everything else has worked (section 5).

**The point worth making to a DPO.** Under a conventional design, need-to-know is a rule the server applies and could fail to apply, through a bug, a misconfiguration or an administrator. Here it is a fact about who holds a key. The most common real breach in this sector, a member of staff looking up a neighbour or an ex-partner, moves from "detected afterwards by audit" to "not possible", because the curious colleague holds no wrapped key and there is nothing to decrypt.

## 3. Article 32(1)(b): confidentiality, integrity, availability and resilience

**Confidentiality.** Section 2, plus the need-to-know model in `docs/NEED-TO-KNOW.md`, which defaults to deny and takes the more restrictive reading wherever the guidance is silent (D-042).

**Integrity.** The audit ledger is a hash chain: every entry carries the hash of its predecessor and is signed with the actor's device key, so an entry cannot be altered or removed without breaking the chain. Signatures with a long verification horizon use ML-DSA-65 alongside Ed25519, because an entry written in 2026 may need to verify in a Learning Review decades later. The Admin verification screen walks the chain and also demonstrates the break being found in a deliberately tampered copy.

**Availability.** This is the obligation the naive reading of "encrypt everything" would have failed, and it is treated as a safety property rather than a service level. Three measures:

1. **Key escrow**, split two of five across five organisations, so no single loss, departure or refusal makes a record unreadable.
2. **A recovery passphrase** per user, stretched with Argon2id, so the common case of a lost laptop does not need anybody else's involvement.
3. **An offline grace period**, seeded at 72 hours, so a practitioner in a house with no signal can still open the safety plan.

**Resilience.** Every ciphertext names its suite, decryption dispatches on the suite it finds rather than the one the code prefers, and `rewrapToSuite` makes a suite change a supported operation. A committed fixture sealed under the first suite is decrypted by a test on every run and is never regenerated.

## 4. Article 32(1)(c): restoring availability and access in a timely manner

The measures in section 3 exist for this obligation specifically, and the reasoning is worth stating because it looks at first like a weakness.

**The ICO's encryption guidance warns that personal information becoming inaccessible through encryption will likely mean the organisation has not implemented appropriate security measures, and that it may itself constitute a personal data breach where the data becomes unavailable.** Its stated mitigation is centrally managed encryption. So a design with no recovery path would not be a stronger reading of Article 32; it would fail 32(1)(c) outright, and could create the very breach it was meant to prevent.

In safeguarding the consequence is sharper than a regulatory finding. A social worker who cannot open an interim safety plan out of hours because a key is unavailable is a child protection incident. Escrow is therefore part of the design rather than a compromise of it, and the DPIA should record it as an availability measure, not only as a disclosure route.

What it takes to use it is set out in `docs/SECURITY.md` section 7 and is deliberately not easy: two holders in two different organisations, a purpose from a fixed list, a recorded lawful basis and written reason, a signed audit entry naming both, and notification to the remaining three.

## 5. Article 32(2): the risks, and what remains after the measures

Article 32(2) asks for the risks of the processing to be taken into account, in particular unauthorised disclosure of or access to personal data. The measures above address most of them. What remains is listed here in full, because a DPIA that records only the mitigations is not a DPIA.

| Residual risk | Why it remains | What reduces it |
|---|---|---|
| Two colluding escrow holders can read any record | There is no cryptographic answer to collusion at the threshold. Raising the threshold trades against availability. | Five holders in five organisations with different lines of accountability; every use signed by both and notified to the other three |
| A compromised practitioner account sees that practitioner's entitlements | An attacker holding the device and credentials holds the keys | Entitlements are per case rather than per caseload; every read audited; device revocation and rotation in the leavers flow |
| A practitioner legitimately on a case misuses what they see | Cryptography prevents access, not misuse by someone entitled to access | Audit, and the Security page saying so plainly rather than implying otherwise |
| The operator sees metadata: record identifiers, key-holder identifiers, coarse record type, classification, day-bucketed timestamps, the existence of links | A server that routes and stores must know something | Opaque rotated identifiers, coarse types, bucketing, and presence as the designed leak. The full table is in `docs/SECURITY.md` 8.1 and on the "What the host can see" screen |
| The blind index reveals equality, and a low-entropy field is open to a frequency attack | Every practical searchable encryption scheme leaks something | Dates of birth bucketed to the month; names excluded entirely; the index covers reference numbers, which practitioners already treat as quasi-public within the partnership |
| A device stolen while unlocked keeps cached access until the grace period expires | Offline working requires cached keys | Device keys in the OS keychain; immediate self-service revocation; the grace period is configuration and its remaining validity is shown |
| Removing someone from a case cannot unread what they already read | Rotation stops future access only | The interface says exactly this at the point of removal, so nobody acts on a false belief that removal retracts |
| The controller can reach any record through escrow | By design. A system that could not produce a record on a sheriff's order would not be lawful to deploy | Split control, recorded lawful basis, signed audit entry, notification |

## 6. Article 32(1)(d): testing and evaluation, and what is not built

**Tested on every run.** Known-answer vectors from RFC 7748, RFC 8032, RFC 5869, FIPS 180-4 and NIST CAVP; a committed ciphertext fixture opened under the earliest suite; the audit chain verified and a tampered copy proved to fail; escrow refusing two holders from one organisation; the mock store asserted to hold no plaintext; a source-level test that fails if any file reintroduces a boolean content gate; a build check that fails on MD5, SHA-1, ECB, DES, RC4, PBKDF2, scrypt, a supplied nonce or the platform pseudo-random source anywhere in the repository; and a generated cryptographic inventory checked for drift.

**Represented, not built.** These belong in the DPIA as assumptions about the deployment rather than as measures in evidence:

- Transport security. There is no transport in a static export with an in-process mock API. In production, TLS 1.3 between client and platform, mutual TLS between the connector gateway and the platform.
- Hardware security module backing for escrow shares. Software shares here.
- The connector gateway as a separately deployed component inside each agency's network. The encryption boundary it implies is structural in the code and asserted by a test, but nothing is deployed.
- Scheduled key rotation. Rotation on demand is implemented; there is no scheduler in a product with no backend.
- Penetration testing and independent cryptographic review. Neither has happened. A safeguarding deployment should have both, and the DPIA should say so.

## 7. Articles 33 and 34: breach notification, and the limit of the encryption argument

**Article 34(3)(a)** removes the obligation to communicate a breach to the data subjects where the controller has implemented protection measures that render the personal data unintelligible to any person not authorised to access it, and encryption is the named example. An exfiltrated copy of this store is ciphertext, and the keys are not in it.

**Article 33 is unaffected, and this repository does not suggest otherwise.** The obligation to notify the ICO within 72 hours is assessed on the facts of the incident. The ICO's position is that the loss of an encrypted dataset may still involve a risk, particularly to availability, and there is more to a breach than confidentiality: an incident that destroys or renders inaccessible the only copy of a child protection record is a breach whether or not anybody read it.

Two further points a DPO should have in front of them:

- The Article 34(3)(a) argument depends on the keys not having gone with the data. It holds for a copied database or backup. It does not hold for a compromised practitioner device, where the attacker holds keys, and it does not hold for a compromised escrow holder.
- Metadata leaves the store intelligible (section 5). An exfiltrated copy still tells an attacker how many records exist, which are Official-Sensitive, which are MAPPA, and roughly when work happens on them. Whether that alone is likely to result in a high risk to rights and freedoms is a judgement for the controller on the facts, and the honest engineering answer is that it is not nothing.

## 8. Article 25: data protection by design and by default

Recorded here because the DPIA will ask and the answers are specific rather than general:

- **Default deny.** The need-to-know model grants nothing that is not granted explicitly, and takes the more restrictive reading where the national guidance is silent (D-042).
- **Data minimisation in the wrapping list.** Presence-level readers are not wrapped to a record, because presence is not content.
- **Purpose limitation in the key hierarchy.** One HKDF info string per purpose, so a key derived for the local store cannot be used as a blind index key.
- **Minimisation in what the operator can see.** Coarse record types, opaque identifiers, bucketed timestamps.
- **Exclusions keyed on role, not identity.** A MARAC perpetrator and a MAPPA victim are excluded by their role on the case, so the exclusion follows the record rather than a name, and the interface cannot lift it (D-035, D-043).
- **Classification derived, not chosen.** The level follows from what a record is about, so it cannot be talked down by whoever is printing it, and lowering it needs a named role and is refused rather than applied quietly (D-059).
- **Every share carries a purpose, a lawful basis, a proportionality note and an author.** That is a brief requirement rather than a cryptographic one, and it is the field the DPIA will want to see populated.

## 9. Article 30 and the inventory

`docs/CRYPTO-INVENTORY.md` is generated from the source by `tooling/crypto-inventory.mjs` and checked for drift as part of `pnpm lint`. It lists every algorithm, its parameters, its rotation schedule and where the key lives.

It is generated rather than written because a hand-written inventory is wrong the first time somebody adds an algorithm and forgets to update it, and because the NCSC's post-quantum migration timeline makes a discovery inventory the deliverable for 2028. This product is already hybrid for key establishment and dual-horizon for signatures, so the 2031 to 2035 milestone is met at first release rather than migrated to.

## 10. Questions a DPO should ask, and the honest answers

- **"Can the supplier read our records?"** No. The platform operator holds no key that decrypts record content. It sees the metadata in section 5, and the "What the host can see" screen in Admin shows exactly that, with real values.
- **"Can anybody read our records?"** Yes, under split control: two escrow holders in two different organisations, with a recorded lawful basis and a signed, notified audit entry. If the answer were no, the council could not answer a subject access request or a sheriff's order.
- **"So it is not really end to end encrypted."** Record content is. The product as a whole is not, and no screen in it says it is. `docs/SECURITY.md` section 1 gives the exact claim.
- **"What happens if somebody loses their laptop?"** The device key is in the OS keychain and the local store is sealed under it. The user revokes the device themselves from Settings. Cached wrapped keys expire at the end of the offline grace period, seeded at 72 hours; that window is the residual risk and it is configuration.
- **"Does this stop a colleague looking up their neighbour?"** Yes, if the colleague is not on the case, and that is the headline defence. It does not stop a colleague who is on the case from misusing what they see; nothing cryptographic does, and the product says so rather than implying otherwise.
- **"Do we still have to report a breach?"** Assume yes and assess it on the facts. Article 34(3)(a) may remove the duty to tell the individuals; it does not remove the duty to consider telling the ICO.

## Provenance

- UK GDPR Articles 5(1)(f), 9, 10, 25, 30, 32, 33, 34 and 35; Data Protection Act 2018 Parts 2 and 3 and Schedule 1.
- ICO, "Encryption" guidance, on inaccessibility through encryption as a security failure and potentially a personal data breach in its own right, and on centrally managed encryption as the mitigation. Read by the product owner on 03 September 2026.
- NCSC, "Timelines for migration to post-quantum cryptography", published 20 March 2025.
- `docs/THREAT-MODEL.md` and `docs/SECURITY.md` in this repository, which this file maps and does not extend.
