interface MetadataWriter {
  from(table: string): {
    upsert(row: Record<string, unknown>, options: { onConflict: string }): {
      select(columns: string): {
        single(): PromiseLike<{ data: { id: string } | null; error: unknown }>;
      };
    };
  };
}

export async function persistEmailIdentity(client: MetadataWriter, row: Record<string, unknown>) {
  const { data, error } = await client.from('email_metadata')
    .upsert(row, { onConflict: 'user_id,gmail_message_id' }).select('id').single();
  if (error || !data?.id) throw new Error('Could not persist Gmail metadata');
  return {
    emailId: data.id,
    internalEmailId: data.id, // Compatibility with previously installed service workers.
    gmailMessageId: String(row.gmail_message_id),
    gmailThreadId: String(row.gmail_thread_id),
    connectedAccountId: String(row.connected_account_id),
    route: `/?email=${encodeURIComponent(data.id)}`,
  };
}
