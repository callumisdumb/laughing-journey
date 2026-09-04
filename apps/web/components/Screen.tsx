'use client';

import { useT, type MessageKey } from '@mas/messages';
import { useEffect } from 'react';
import { Actions } from '@/features/actions/Actions';
import { Admin } from '@/features/admin/Admin';
import { Audit } from '@/features/audit/Audit';
import { Connectors } from '@/features/connectors/Connectors';
import { Help } from '@/features/help/Help';
import { ChronologyScreen } from '@/features/chronology/ChronologyScreen';
import { Home } from '@/features/home/Home';
import { Inbox } from '@/features/inbox/Inbox';
import { MeetingList } from '@/features/meetings/MeetingList';
import { MeetingWorkspace } from '@/features/meetings/MeetingWorkspace';
import { PeopleList } from '@/features/people/PeopleList';
import { PersonRecord } from '@/features/person/PersonRecord';
import { PractitionerCard } from '@/features/practitioner/PractitionerCard';
import { Placeholder } from '@/features/placeholder/Placeholder';
import { ProcessList } from '@/features/process/ProcessList';
import { ProcessScreen } from '@/features/process/ProcessScreen';
import { Reports } from '@/features/reports/Reports';
import { Search } from '@/features/search/Search';
import { Settings } from '@/features/settings/Settings';
import { Sharing } from '@/features/sharing/Sharing';
import { Worklist } from '@/features/worklist/Worklist';
import { useRoute } from '@/lib/router';

/** Browser tab title for each route head; entity routes take their section's title. */
const TITLE_KEYS = {
  '': 'nav.titles.home',
  worklist: 'nav.titles.worklist',
  people: 'nav.titles.people',
  practitioners: 'nav.titles.practitioners',
  search: 'nav.titles.search',
  inbox: 'nav.titles.inbox',
  processes: 'nav.titles.processes',
  meetings: 'nav.titles.meetings',
  actions: 'nav.titles.actions',
  sharing: 'nav.titles.sharing',
  connectors: 'nav.titles.connectors',
  reports: 'nav.titles.reports',
  audit: 'nav.titles.audit',
  admin: 'nav.titles.admin',
  settings: 'nav.titles.settings',
  help: 'nav.titles.help',
} as const satisfies Record<string, MessageKey>;

type TitleKey = (typeof TITLE_KEYS)[keyof typeof TITLE_KEYS];

/** Route table. Entity routes read their id from the path segments. */
export function Screen() {
  const t = useT();
  const route = useRoute();
  const [head, id, sub] = route.segments;

  useEffect(() => {
    const key = (TITLE_KEYS as Record<string, TitleKey>)[head ?? ''];
    // A person's own screen is the Person record, not the People list it was reached from (D-057).
    const screen = head === 'people' && id ? t('person.screenName') : key ? t(key) : t('product.name');
    document.title = t('common.app.titleWithScreen', { screen, app: t('product.name') });
  }, [head, id, t]);

  switch (head) {
    case undefined:
      return <Home />;
    case 'worklist':
      return <Worklist />;
    case 'people':
      if (id && sub === 'chronology') return <ChronologyScreen personId={id} />;
      if (id) return <PersonRecord personId={id} />;
      return <PeopleList />;
    case 'practitioners':
      return id ? <PractitionerCard userId={id} /> : <Placeholder title={t('states.placeholder.notFound')} phase={0} />;
    case 'search':
      return <Search />;
    case 'inbox':
      return <Inbox />;
    case 'processes':
      return id ? <ProcessScreen processId={id} /> : <ProcessList />;
    case 'meetings':
      return id ? <MeetingWorkspace meetingId={id} /> : <MeetingList />;
    case 'actions':
      return <Actions />;
    case 'sharing':
      return <Sharing />;
    case 'connectors':
      return <Connectors />;
    case 'reports':
      return <Reports kind={id} />;
    case 'audit':
      return <Audit />;
    case 'admin':
      return <Admin section={id} />;
    case 'settings':
      return <Settings />;
    case 'help':
      return <Help />;
    default:
      return <Placeholder title={t('states.placeholder.notFound')} phase={0} />;
  }
}
