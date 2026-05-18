update payout_batches
set state = 'partially_approved'
where state = 'pending_approval'
  and exists (
    select 1
    from payout_batch_approval_contexts context
    where context.batch_id = payout_batches.batch_id
      and context.status = 'pending'
      and coalesce(context.current_approval_level, 1) > 1
  );

update payout_batches
set state = 'sent_to_bank'
where state = 'dispatched';

update payout_batches
set state = 'paid'
where state = 'completed';

update payout_batches
set state = 'failed',
    failure_reason = coalesce(failure_reason, 'One or more payout items failed in mock bank processing')
where state = 'partially_processed';

update payout_items
set state = 'sent_to_bank'
where state = 'dispatched';
