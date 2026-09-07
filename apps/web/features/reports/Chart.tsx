'use client';

import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import type { ChartSpec } from './model';
import { StackedBarChart } from './StackedBarChart';

export function Chart({ spec }: { spec: ChartSpec }) {
  switch (spec.kind) {
    case 'bar':
      return <BarChart spec={spec} />;
    case 'stacked':
      return <StackedBarChart spec={spec} />;
    case 'line':
      return <LineChart spec={spec} />;
  }
}
