'use client';

import { useEffect } from 'react';
import { Actions } from '@/features/actions/Actions';
import { Audit } from '@/features/audit/Audit';
import { Connectors } from '@/features/connectors/Connectors';
import { Help } from '@/features/help/Help';
import { ChronologyScreen } from '@/features/chronology/ChronologyScreen';
import { Home } from '@/features/home/Home';
import { Inbox } from '@/features/inbox/Inbox';
import { MeetingList } from '@/features/meetings/MeetingList';
import { MeetingWorkspace } from '@/features/meetings/MeetingWorkspace';
import { PeopleList } from '@/features/people/PeopleList';
import { Person360 } from '@/features/person/Person360';
import { Placeholder } from '@/features/placeholder/Placeholder';
import { ProcessList } from '@/features/process/ProcessList';
import { ProcessScreen } from '@/features/process/ProcessScreen';
import { Search } from '@/features/search/Search';
import { Settings } from '@/features/settings/Settings';
import { Sharing } from '@/features/sharing/Sharing';
import { Worklist } from '@/features/worklist/Worklist';
import { useRoute } from '@/lib/router';

/** Route table. Entity routes read their id from the path segments. */
export function Screen() {
  const route = useRoute();
  const [head, id, sub] = route.segments;

  useEffect(() => {
    const titles: Record<string, string> = { '': 'Home', worklist: 'Worklist', people: 'People', search: 'Search', inbox: 'Inbox', processes: 'Processes', meetings: 'Meetings', actions: 'Actions', sharing: 'Sharing', connectors: 'Connectors', reports: 'Reports', audit: 'Audit', admin: 'Admin', settings: 'Settings', help: 'Help' };
    document.title = `${titles[head ?? ''] ?? 'Platform'}: Platform`;
  }, [head]);

  switch (head) {
    case undefined:
      return <Home />;
    case 'worklist':
      return <Worklist />;
    case 'people':
      if (id && sub === 'chronology') return <ChronologyScreen personId={id} />;
      if (id) return <Person360 personId={id} />;
      return <PeopleList />;
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
      return <Placeholder title="Reports" phase={5} />;
    case 'audit':
      return <Audit />;
    case 'admin':
      return <Placeholder title="Admin" phase={5} />;
    case 'settings':
      return <Settings />;
    case 'help':
      return <Help />;
    default:
      return <Placeholder title="Not found" phase={0} />;
  }
}
