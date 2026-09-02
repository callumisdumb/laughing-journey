'use client';

import { useEffect } from 'react';
import { ChronologyScreen } from '@/features/chronology/ChronologyScreen';
import { Home } from '@/features/home/Home';
import { Inbox } from '@/features/inbox/Inbox';
import { PeopleList } from '@/features/people/PeopleList';
import { Person360 } from '@/features/person/Person360';
import { Placeholder } from '@/features/placeholder/Placeholder';
import { Search } from '@/features/search/Search';
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
      return <Placeholder title={id ? 'Process' : 'Processes'} phase={3} />;
    case 'meetings':
      return <Placeholder title={id ? 'Meeting workspace' : 'Meetings'} phase={4} />;
    case 'actions':
      return <Placeholder title="Actions" phase={4} />;
    case 'sharing':
      return <Placeholder title="Sharing and notifications" phase={4} />;
    case 'connectors':
      return <Placeholder title="Connectors" phase={5} />;
    case 'reports':
      return <Placeholder title="Reports" phase={5} />;
    case 'audit':
      return <Placeholder title="Audit" phase={5} />;
    case 'admin':
      return <Placeholder title="Admin" phase={5} />;
    case 'settings':
      return <Placeholder title="Settings" phase={5} />;
    case 'help':
      return <Placeholder title="Help" phase={5} />;
    default:
      return <Placeholder title="Not found" phase={0} />;
  }
}
