export interface GlossaryEntry {
  term: string;
  definition: string;
}

/** Appendix A of the brief. Used for first-use tooltips and the Help screen. */
export const GLOSSARY: GlossaryEntry[] = [
  { term: 'APC', definition: 'Adult Protection Committee' },
  { term: 'ASP', definition: 'Adult Support and Protection' },
  { term: 'AWI', definition: 'Adults with Incapacity' },
  { term: 'CHI', definition: 'Community Health Index number' },
  { term: 'COG', definition: 'Chief Officers Group' },
  { term: 'CP', definition: 'Child protection' },
  { term: 'CPC', definition: 'Child Protection Committee' },
  { term: 'CPO', definition: 'Child Protection Order' },
  { term: 'CPPM', definition: 'Child Protection Planning Meeting' },
  { term: 'CSWO', definition: 'Chief Social Work Officer' },
  { term: 'DAQ', definition: 'Domestic Abuse Questions (Police Scotland)' },
  { term: 'DASH', definition: 'Domestic Abuse, Stalking, Harassment and Honour-based violence risk checklist (SafeLives)' },
  { term: 'DSDAS', definition: 'Disclosure Scheme for Domestic Abuse Scotland' },
  { term: 'DTC', definition: 'Duty to cooperate (MAPPA)' },
  { term: 'ERA', definition: 'Environmental Risk Assessment' },
  { term: 'GIRFEC', definition: 'Getting it right for every child' },
  { term: 'HSCP', definition: 'Health and Social Care Partnership' },
  { term: 'IDAA', definition: 'Independent Domestic Abuse Advocate' },
  { term: 'IRD', definition: 'Inter-agency Referral Discussion' },
  { term: 'iVPD', definition: 'interim Vulnerable Persons Database (Police Scotland)' },
  { term: 'JII', definition: 'Joint Investigative Interview' },
  { term: 'JPFE', definition: 'Joint Paediatric Forensic Examination' },
  { term: 'LSI', definition: 'Large Scale Investigation' },
  { term: 'LS/CMI', definition: 'Level of Service/Case Management Inventory' },
  { term: 'MAPPA', definition: 'Multi-Agency Public Protection Arrangements' },
  { term: 'MAPPP', definition: 'Multi-Agency Public Protection Panel (Level 3)' },
  { term: 'MAPPS', definition: 'Multi-Agency Public Protection System (ViSOR replacement)' },
  { term: 'MARAC', definition: 'Multi-Agency Risk Assessment Conference' },
  { term: 'MATAC', definition: 'Multi Agency Tasking and Coordination' },
  { term: 'MHO', definition: 'Mental Health Officer' },
  { term: 'MWC', definition: 'Mental Welfare Commission for Scotland' },
  { term: 'OLR', definition: 'Order for Lifelong Restriction' },
  { term: 'OPG', definition: 'Office of the Public Guardian (Scotland)' },
  { term: 'PoA', definition: 'Power of Attorney' },
  { term: 'PPU', definition: 'Public Protection Unit' },
  { term: 'RA', definition: 'Responsible Authority (MAPPA)' },
  { term: 'RMA', definition: 'Risk Management Authority' },
  { term: 'RMP', definition: 'Risk Management Plan' },
  { term: 'RM2000', definition: 'Risk Matrix 2000' },
  { term: 'SA07', definition: 'Stable and Acute 2007' },
  { term: 'SCIM', definition: 'Scottish Child Interview Model' },
  { term: 'SCRA', definition: "Scottish Children's Reporter Administration" },
  { term: 'SEEMIS', definition: 'Scottish schools management information system' },
  { term: 'SHANARRI', definition: 'Safe, Healthy, Achieving, Nurtured, Active, Respected, Responsible, Included' },
  { term: 'SOG', definition: 'Strategic Oversight Group (MAPPA)' },
  { term: 'SONR', definition: 'Sex Offender Notification Requirements' },
  { term: 'SPS', definition: 'Scottish Prison Service' },
  { term: 'VNS', definition: 'Victim Notification Scheme' },
  { term: 'ViSOR', definition: 'Violent and Sex Offender Register' },
];

export function glossaryLookup(term: string): GlossaryEntry | undefined {
  return GLOSSARY.find((g) => g.term.toLowerCase() === term.toLowerCase());
}
