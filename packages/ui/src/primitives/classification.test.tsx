import { OFFICIAL, classify, officialSensitive, type ClassificationSubject } from '@mas/domain';
import { t } from '@mas/messages';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassificationMarking, ClassificationTag } from './Classification';

const MARKING = 'OFFICIAL-SENSITIVE';

/**
 * The artefacts the Annex 2 rule table (docs/RESEARCH.md 5.13, section 2.3) says are
 * Official-Sensitive. Every one must render a marking, on screen and in print.
 */
const MARKED: Array<[string, ClassificationSubject]> = [
  ['MAPPA meeting minute', { process: 'mappa', artefact: 'meeting-minute' }],
  ['MAPPA Risk Management Plan', { process: 'mappa', artefact: 'risk-management-plan' }],
  ['MAPPA Environmental Risk Assessment', { process: 'mappa', artefact: 'environmental-risk-assessment' }],
  ['MAPPA disclosure decision', { process: 'mappa', artefact: 'disclosure-decision' }],
  ['MAPPA pre-meeting return', { process: 'mappa', artefact: 'pre-meeting-return' }],
  ['MARAC referral', { process: 'marac', artefact: 'referral' }],
  ['MARAC research return', { process: 'marac', artefact: 'research-return' }],
  ['MARAC meeting record', { process: 'marac', artefact: 'meeting-minute' }],
  ['MARAC action plan', { process: 'marac', artefact: 'action-plan' }],
  ['CP IRD record', { process: 'cp', artefact: 'ird-record' }],
  ['CP JII planning record', { process: 'cp', artefact: 'jii-planning-record' }],
  ['CPPM minute', { process: 'cp', artefact: 'cppm-minute' }],
  ['ASP protection order application', { process: 'asp', artefact: 'protection-order-application' }],
  ['LSI workspace', { process: 'asp', artefact: 'lsi-workspace' }],
  ['break-glass audit entry', { artefact: 'break-glass-audit' }],
  ['audit export', { artefact: 'audit-export' }],
  ['connector credentials', { artefact: 'connector-credentials' }],
  ['record naming a perpetrator', { namesPerpetrator: true }],
  ['special category data', { specialCategoryData: true }],
  ['criminal offence data', { criminalOffenceData: true }],
  ['person record linked to a restricted process', { artefact: 'person-record', hasOpenRestrictedProcess: true }],
];

/** The artefacts the same table says are Official. Annex 2 paragraph 5: no marking is required. */
const UNMARKED: Array<[string, ClassificationSubject]> = [
  ['person record with no open restricted process', { artefact: 'person-record' }],
  ['worklist', { artefact: 'worklist' }],
  ['aggregate report', { artefact: 'aggregate-report' }],
  ['empty state', { artefact: 'empty-state' }],
  ['Admin configuration', { artefact: 'admin-configuration' }],
  ['glossary', { artefact: 'glossary' }],
];

describe('ClassificationMarking', () => {
  it.each(MARKED)('marks the %s in print', (_name, subject) => {
    const { container } = render(<ClassificationMarking classification={classify(subject).classification} />);
    expect(screen.getByRole('note')).toHaveTextContent(MARKING);
    // Centred and uppercase come from the CSS module, so the identity travels with the class.
    expect(container.firstElementChild?.className).toMatch(/print/);
  });

  it.each(UNMARKED)('renders nothing for the %s', (_name, subject) => {
    const { container } = render(<ClassificationMarking classification={classify(subject).classification} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('appends handling instructions after the marking', () => {
    render(<ClassificationMarking classification={officialSensitive(['Distribution list only'])} />);
    expect(screen.getByRole('note')).toHaveTextContent('OFFICIAL-SENSITIVE Distribution list only');
  });

  it('renders nothing at Official even when asked directly', () => {
    const { container } = render(<ClassificationMarking classification={OFFICIAL} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ClassificationTag', () => {
  it.each(MARKED)('tags the %s on screen', (_name, subject) => {
    render(<ClassificationTag classification={classify(subject).classification} />);
    expect(screen.getByLabelText(t('common.marks.classification', { level: MARKING }))).toBeInTheDocument();
  });

  it.each(UNMARKED)('renders nothing for the %s', (_name, subject) => {
    const { container } = render(<ClassificationTag classification={classify(subject).classification} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('never carries the meaning in colour alone', () => {
    const { container } = render(<ClassificationTag classification={officialSensitive()} />);
    // The words are present as text, and the lock glyph reinforces them.
    expect(container).toHaveTextContent(MARKING);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
