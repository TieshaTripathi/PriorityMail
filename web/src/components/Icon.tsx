export type IconName = 'inbox' | 'mail' | 'rules' | 'star' | 'settings' | 'arrow' | 'check' | 'clock' | 'plus' | 'close' | 'search' | 'bell' | 'refresh';
const paths: Record<IconName, string> = {
  inbox: 'M4 4h16v16H4z M4 13h5l2 3h2l2-3h5',
  mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
  rules: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  arrow: 'M5 12h14m-6-6 6 6-6 6', check: 'm5 12 4 4L19 6',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
  plus: 'M12 5v14M5 12h14', close: 'm6 6 12 12M18 6 6 18',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',
  bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 20h4',
  refresh: 'M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5',
};
export function Icon({ name }: { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
