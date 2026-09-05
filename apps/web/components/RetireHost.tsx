'use client';

import { RecordedInErrorDialog } from '@/components/RecordedInErrorDialog';
import { useRetire } from '@/lib/retire';

/** Mounts the retire dialog once, wherever `useRetire` points it. */
export function RetireHost() {
  const target = useRetire((s) => s.target);
  const clear = useRetire((s) => s.clear);
  if (!target) return null;
  return <RecordedInErrorDialog collection={target.collection} id={target.id} label={target.label} open onClose={clear} />;
}
