import { useState } from 'react';
import type { ConnectedAccountDto } from '../services/apiClient';
import {
  startConnectGmailAccount,
  disconnectAccount,
} from '../services/apiClient';
import { Icon } from './Icon';

interface Props {
  accounts: ConnectedAccountDto[];
  onAccountAdded: () => void;
  onAccountRemoved: (id: string) => void;
  onToast: (msg: string) => void;
}

export function ConnectedAccountsList({
  accounts,
  onAccountAdded,
  onAccountRemoved,
  onToast,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAddAccount = async () => {
    setConnecting(true);
    try {
      const url = await startConnectGmailAccount();
      // Open Gmail OAuth in the same tab so session cookies work
      window.location.assign(url);
    } catch {
      onToast('Could not start Gmail connection. Is the backend running?');
      setConnecting(false);
    }
  };

  const handleDisconnect = async (account: ConnectedAccountDto) => {
    const confirmed = window.confirm(
      `Disconnect ${account.email}?\n\nPriorityMail will stop fetching emails from this account.`,
    );
    if (!confirmed) return;

    setRemovingId(account.id);
    try {
      await disconnectAccount(account.id);
      onAccountRemoved(account.id);
      onToast(`${account.email} has been disconnected.`);
    } catch {
      onToast('Could not disconnect account. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="settings-card" aria-label="Connected Gmail accounts">
      {accounts.length === 0 && (
        <p className="help" style={{ margin: '0 0 12px' }}>
          No Gmail accounts connected yet. Add one to see real emails.
        </p>
      )}

      {accounts.map((account) => (
        <div className="connected" key={account.id}>
          {account.avatarUrl ? (
            <img
              className="avatar"
              src={account.avatarUrl}
              alt={account.displayName[0]}
              width={36}
              height={36}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="avatar">{account.displayName[0]}</span>
          )}
          <div className="grow">
            <strong>{account.displayName}</strong>
            <small>{account.email}</small>
            <span className="demo-tag" style={{ color: 'var(--green, #22c55e)' }}>
              Connected{account.isPrimary ? ' · Primary' : ''}
            </span>
          </div>
          <button
            className="text-button danger"
            aria-label={`Disconnect ${account.email}`}
            disabled={removingId === account.id}
            onClick={() => handleDisconnect(account)}
          >
            {removingId === account.id ? '…' : 'Disconnect'}
          </button>
        </div>
      ))}

      <button
        id="add-gmail-account-btn"
        type="button"
        className="secondary full"
        disabled={connecting}
        onClick={handleAddAccount}
        aria-busy={connecting}
      >
        <Icon name="plus" />
        {connecting ? 'Opening Google…' : 'Add Gmail Account'}
      </button>

      <p className="help">
        PriorityMail requests read-only Gmail access. You can connect
        multiple accounts and switch between them in All Emails.
      </p>
    </section>
  );
}
