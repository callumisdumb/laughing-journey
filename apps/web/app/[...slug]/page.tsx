import { buildDataset } from '@mas/mock-data';
import { AppRoot } from '@/components/AppRoot';
import { REPORT_KINDS, STATIC_ROUTES } from '@/lib/routes';

export const dynamicParams = false;

/** Every known path is prerendered; navigation between them is client-side (DECISIONS D-004). */
export function generateStaticParams(): Array<{ slug: string[] }> {
  const data = buildDataset();
  const slugs: string[][] = [
    ...STATIC_ROUTES.map((r) => r.split('/')),
    ...REPORT_KINDS.map((k) => ['reports', k]),
    ...data.people.flatMap((p) => [['people', p.id], ['people', p.id, 'chronology']]),
    ...data.processes.map((p) => ['processes', p.id]),
    ...data.meetings.map((m) => ['meetings', m.id]),
  ];
  return slugs.map((slug) => ({ slug }));
}

export default function CatchAllPage() {
  return <AppRoot />;
}
