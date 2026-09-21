export function subscribeInboxRefresh(refresh: () => void, win = window, doc = document, worker?: EventTarget) {
  const visibleRefresh = () => { if (doc.visibilityState === 'visible') refresh(); };
  const pushed = (event: Event) => {
    if ((event as MessageEvent).data?.type === 'prioritymail-inbox-refresh') visibleRefresh();
  };
  worker?.addEventListener('message', pushed);
  win.addEventListener('focus', visibleRefresh);
  doc.addEventListener('visibilitychange', visibleRefresh);
  const timer = win.setInterval(visibleRefresh, 30000);
  return () => {
    worker?.removeEventListener('message', pushed);
    win.removeEventListener('focus', visibleRefresh);
    doc.removeEventListener('visibilitychange', visibleRefresh);
    win.clearInterval(timer);
  };
}
