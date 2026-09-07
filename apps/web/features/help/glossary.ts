/**
 * The glossary (Appendix A of the brief, in display order) lives in the domain package, which
 * reads `glossary.<id>.term` and `glossary.<id>.definition` from the message catalogue. This
 * module re-exports it so the Help screen keeps its import path: there is one id list.
 */
export { GLOSSARY_IDS, glossaryDefinition, glossaryEntries, glossaryEntry, glossaryLookup, glossaryTerm, type GlossaryEntry, type GlossaryId } from '@mas/domain';
