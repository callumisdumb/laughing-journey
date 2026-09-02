'use client';

import { useEffect } from 'react';
import { Home } from '@/features/home/Home';
import { Placeholder } from '@/features/placeholder/Placeholder';
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
      return <Placeholder title="Worklist" phase={2} />;
    case 'people':
      if (id && sub === 'chronology') return <Placeholder title="Integrated chronology" phase={2} />;
      if (id) return <Placeholder title="Person 360" phase={2} />;
      return <Placeholder title="People" phase={2} />;
    case 'search':
      return <Placeholder title="Search" phase={2} />;
    case 'inbox':
      return <Placeholder title="Connector inbox" phase={2} />;
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
