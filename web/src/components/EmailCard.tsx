import type { PriorityEmail } from '../types';
import { Icon } from './Icon';

export function PriorityBadge({ priority }: { priority: PriorityEmail['priority'] }) {
  return <span className={`badge ${priority}`}><span className="dot" />{priority === 'high' ? 'Action required' : priority === 'fyi' ? 'FYI' : priority}</span>;
}
export function EmailCard({ email, onOpen, onDone, onSnooze }: { email: PriorityEmail; onOpen: () => void; onDone: () => void; onSnooze: () => void }) {
  return <article className={`email-card ${email.isCompleted ? 'completed' : ''}`}>
    <div className="card-top"><PriorityBadge priority={email.priority} /><span className="muted tiny">{email.receivedAt}</span></div>
    <button className="email-open" onClick={onOpen} aria-label={`Read ${email.subject}`}>
      <div className="sender-line"><span className={`avatar ${email.category}`}>{email.senderName.split(' ').map(s => s[0]).slice(0, 2).join('')}</span><div><strong>{email.senderName}</strong><span className="account-label">{email.accountEmail}</span></div>{!email.isRead && <span className="unread-dot" />}</div>
      <h3>{email.subject}</h3><p className="snippet">{email.snippet}</p>
    </button>
    {email.deadline && <div className="deadline"><Icon name="clock" /><span>{email.deadline}</span></div>}
    <div className="reason-row"><Icon name="star" /><span>{email.reasons[0] || email.reason}</span></div>
    {email.snoozedUntil && <p className="tiny muted">Snoozed until {new Date(email.snoozedUntil).toLocaleString()}</p>}
    <div className="card-actions"><button className="text-button blue" onClick={onOpen}>Open email <Icon name="arrow" /></button><button className="text-button" onClick={onDone}><Icon name="check" />{email.isCompleted ? 'Undo' : 'Done'}</button><button className="icon-button" aria-label={`Snooze ${email.subject}`} onClick={onSnooze}><Icon name="clock" /></button></div>
  </article>;
}
