import react from '@mas/eslint-config/react';
import { copyRule } from '@mas/eslint-config/copy';

/**
 * Files listed under copyRule have moved their copy to the message catalogue; the rule keeps them
 * that way. The list grows namespace by namespace until it is a single wildcard.
 */
export default [
  ...react,
  { ignores: ['next-env.d.ts', '.next/**', 'out/**', 'playwright-report/**', 'test-results/**'] },
  copyRule(['components/AppRoot.tsx', 'lib/messages-store.ts', 'features/admin/Copy.tsx', 'features/settings/Settings.tsx', 'features/help/Help.tsx', 'features/help/glossary.ts', 'features/admin/Admin.tsx', 'features/admin/Agencies.tsx', 'features/admin/Defaults.tsx', 'features/admin/Forms.tsx', 'features/admin/Markings.tsx', 'features/admin/NeedToKnow.tsx', 'features/admin/Overview.tsx', 'features/admin/SectionHead.tsx', 'features/admin/Timescales.tsx', 'features/admin/Users.tsx', 'features/admin/sections.ts', 'features/admin/useAdminConfig.ts', 'components/AppLink.tsx', 'components/Screen.tsx', 'components/ScreenState.tsx', 'components/shell/AppShell.tsx', 'components/shell/ContextDrawer.tsx', 'components/shell/PersonaSwitcher.tsx', 'components/shell/Rail.tsx', 'components/shell/SearchBox.tsx', 'components/shell/TopBar.tsx', 'features/home/Home.tsx', 'features/placeholder/Placeholder.tsx', 'features/search/Search.tsx', 'features/sign-in/SignIn.tsx', 'features/worklist/Worklist.tsx', 'lib/routes.ts', 'features/people/PeopleList.tsx', 'features/person/Person360.tsx', 'features/person/NetworkGraph.tsx', 'features/chronology/AddEventDialog.tsx', 'features/chronology/ChronologyScreen.tsx', 'features/chronology/EventList.tsx', 'features/chronology/LanesChart.tsx', 'features/chronology/PrintPack.tsx', 'features/chronology/state.ts', 'features/chronology/useChronology.ts', 'features/inbox/Inbox.tsx', 'lib/selectors.ts', 'features/meetings/MeetingList.tsx', 'features/meetings/MeetingWorkspace.tsx', 'features/meetings/MinutesPrintPack.tsx', 'features/actions/Actions.tsx', 'features/sharing/Sharing.tsx', 'features/process/ProcessList.tsx', 'features/process/ProcessScreen.tsx', 'features/process/forms/*.tsx', 'features/process/panels/*.tsx', 'features/connectors/Connectors.tsx', 'features/reports/*.ts', 'features/reports/*.tsx', 'features/audit/Audit.tsx']),
];
