import { loadConfig } from "../../packages/shared/src/config.js";
import { getDatabasePool } from "../../packages/shared/src/db.js";

const config = loadConfig();
const db = getDatabasePool(config);

async function main() {
  await db.query(
    `insert into bank_tenants (tenant_id, name, subdomain, primary_color, contact_email, status)
     values
       ('bank-alpha', 'Bank Alpha', 'alpha', '#1144AA', 'ops@alpha.bank', 'active'),
       ('bank-beta', 'Bank Beta', 'beta', '#227744', 'ops@beta.bank', 'active')
     on conflict (tenant_id) do update
     set name = excluded.name,
         subdomain = excluded.subdomain,
         primary_color = excluded.primary_color,
         contact_email = excluded.contact_email,
         status = excluded.status`
  );

  const mayaTenantLookup = await db.query<{
    tenant_id: string;
    bank_tenant_id: string;
    name: string;
  }>(
    `select tenant_id, bank_tenant_id, name
     from corporate_tenants
     where lower(name) like '%maya%' or lower(legal_entity_name) like '%maya%'
     order by tenant_id
     limit 1`
  );

  let mayaCorporateTenantId = "corp-maya-pharma";
  let mayaBankTenantId = "bank-alpha";

  if (mayaTenantLookup.rows[0]) {
    mayaCorporateTenantId = mayaTenantLookup.rows[0].tenant_id;
    mayaBankTenantId = mayaTenantLookup.rows[0].bank_tenant_id;
  } else {
    await db.query(
      `insert into corporate_tenants (
         tenant_id, bank_tenant_id, name, legal_entity_name, corporate_admin_email, status
       )
       values
         ('corp-maya-pharma', 'bank-alpha', 'Maya Pharma', 'Maya Pharma Private Limited', 'admin@mayapharma.com', 'active')
       on conflict (tenant_id) do update
       set bank_tenant_id = excluded.bank_tenant_id,
           name = excluded.name,
           legal_entity_name = excluded.legal_entity_name,
           corporate_admin_email = excluded.corporate_admin_email,
           status = excluded.status`
    );
  }

  await db.query(
    `insert into corporate_tenants (
       tenant_id, bank_tenant_id, name, legal_entity_name, corporate_admin_email, status
     )
     values
       ('corp-acme', 'bank-alpha', 'Acme Corp', 'Acme Corporation Private Limited', 'admin@acme.com', 'active'),
       ('corp-zen', 'bank-beta', 'Zen Corp', 'Zen Corp Private Limited', 'admin@zen.com', 'active')
     on conflict (tenant_id) do update
     set bank_tenant_id = excluded.bank_tenant_id,
         name = excluded.name,
         legal_entity_name = excluded.legal_entity_name,
         corporate_admin_email = excluded.corporate_admin_email,
         status = excluded.status`
  );

  await db.query(
    `insert into corporates (
       corporate_id, corporate_tenant_id, bank_tenant_id, name, legal_entity_name,
       corporate_admin_email, status
     )
     values
       (
         'corp-acme-corp-001',
         'corp-acme',
         'bank-alpha',
         'Acme Corporation Private Limited',
         'Acme Corporation Private Limited',
         'admin@acme.com',
         'active'
       ),
       (
         'corp-zen-corp-001',
         'corp-zen',
         'bank-beta',
         'Zen Corp Private Limited',
         'Zen Corp Private Limited',
         'admin@zen.com',
         'active'
       )
     on conflict (corporate_id) do update
     set corporate_tenant_id = excluded.corporate_tenant_id,
         bank_tenant_id = excluded.bank_tenant_id,
         name = excluded.name,
         legal_entity_name = excluded.legal_entity_name,
         corporate_admin_email = excluded.corporate_admin_email,
         status = excluded.status`
  );

  const mayaCorporateLookup = await db.query<{ corporate_id: string }>(
    `select corporate_id
     from corporates
     where corporate_tenant_id = $1
       and (lower(name) like '%maya%' or lower(legal_entity_name) like '%maya%')
     order by
       case when corporate_id like 'co-%' then 0 else 1 end,
       corporate_id
     limit 1`,
    [mayaCorporateTenantId]
  );

  let mayaCorporateId = mayaCorporateLookup.rows[0]?.corporate_id;

  if (!mayaCorporateId) {
    mayaCorporateId = "corp-maya-pharma-corp-001";

    await db.query(
      `insert into corporates (
         corporate_id, corporate_tenant_id, bank_tenant_id, name, legal_entity_name,
         corporate_admin_email, status
       )
       values
         (
           $1,
           $2,
           $3,
           'Maya Pharma',
           'Maya Pharma Private Limited',
           'admin@mayapharma.com',
           'active'
         )
       on conflict (corporate_id) do update
       set corporate_tenant_id = excluded.corporate_tenant_id,
           bank_tenant_id = excluded.bank_tenant_id,
           name = excluded.name,
           legal_entity_name = excluded.legal_entity_name,
           corporate_admin_email = excluded.corporate_admin_email,
           status = excluded.status`,
      [mayaCorporateId, mayaCorporateTenantId, mayaBankTenantId]
    );
  }

  await db.query(
    `insert into onboarding_applications (
       application_id, onboarding_mode, bank_tenant_id, corporate_tenant_id, corporate_tenant_name, legal_entity_name, signatory_name, gstin, pan, cin,
       registered_address, primary_corporate_admin_email, state, review_comment
     )
     values
       (
         'app-alpha-001',
         'new_corporate_under_existing_tenant',
         'bank-alpha',
         'corp-acme',
         null,
         'Acme Corporation Private Limited',
         'Anita Sharma',
         '29ABCDE1234F1Z5',
         'ABCDE1234F',
         'U12345KA2024PTC123456',
         '12 MG Road, Bengaluru, Karnataka',
         'admin@acme.com',
         'submitted',
         'Seeded sample application'
       )
     on conflict (application_id) do update
     set onboarding_mode = excluded.onboarding_mode,
         bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_tenant_name = excluded.corporate_tenant_name,
         legal_entity_name = excluded.legal_entity_name,
         signatory_name = excluded.signatory_name,
         gstin = excluded.gstin,
         pan = excluded.pan,
         cin = excluded.cin,
         registered_address = excluded.registered_address,
         primary_corporate_admin_email = excluded.primary_corporate_admin_email,
         state = excluded.state,
         review_comment = excluded.review_comment`
  );

  await db.query(
    `insert into beneficiaries (
       beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name, account_number, ifsc,
       type, pan, gstin, phone_number, category, tags, status, approval_state, review_comment, updated_at
     )
     values
       (
         'ben-acme-001',
         'bank-alpha',
         'corp-acme',
         'corp-acme-corp-001',
         'Reliance Industries Limited',
         '123456789012',
         'HDFC0001234',
         'vendor',
         'ABCDE1234F',
         '29ABCDE1234F1Z5',
         '9876543210',
         'opex',
         array['preferred','bulk'],
         'active',
         'approved',
         'Seeded approved beneficiary',
         now()
       ),
       (
         'ben-zen-001',
         'bank-beta',
         'corp-zen',
         'corp-zen-corp-001',
         'GST Department Karnataka',
         '987654321098',
         'SBIN0004321',
         'statutory',
         'ABCDE1234F',
         '29ABCDE1234F1Z5',
         '9988776655',
         'tax',
         array['statutory'],
         'active',
         'approved',
         'Seeded approved beneficiary',
         now()
       )
     on conflict (beneficiary_id) do update
     set bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_id = excluded.corporate_id,
         name = excluded.name,
         account_number = excluded.account_number,
         ifsc = excluded.ifsc,
         type = excluded.type,
         pan = excluded.pan,
         gstin = excluded.gstin,
         phone_number = excluded.phone_number,
         category = excluded.category,
         tags = excluded.tags,
         status = excluded.status,
         approval_state = excluded.approval_state,
         review_comment = excluded.review_comment,
         updated_at = excluded.updated_at`
  );

  await db.query(
    `insert into payout_batches (
       batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, created_by_user_id, created_by_role, title,
       tag, remark, state, total_amount, approval_comment, bank_reference, created_at, submitted_at,
       submitted_by_user_id, submitted_by_role, approved_at, approved_by_user_id, approved_by_role,
       dispatched_at, completed_at, failure_reason
     )
     values
       (
         'batch-acme-001',
         'bank-alpha',
         'corp-acme',
         'corp-acme-corp-001',
         'user-maker-001',
         'maker',
         'April vendor payouts',
         'vendor',
         'April vendor settlement',
         'approved',
         125000.00,
         'Approved by bank checker',
         null,
         now() - interval '1 day',
         now() - interval '23 hour',
         'user-maker-001',
         'maker',
         now() - interval '22 hour',
         'user-maya-checker-001',
         'checker',
         null,
         null,
         null
       ),
       (
         'batch-acme-002',
         'bank-alpha',
         'corp-acme',
         'corp-acme-corp-001',
         'user-maker-002',
         'maker',
         'Completed utility settlement',
         'utility',
         'Completed utility settlement',
         'completed',
         48000.00,
         'Processed successfully',
         'BANKALPHA-DISP-BATCHACME002',
         now() - interval '3 day',
         now() - interval '3 day',
         'user-maker-002',
         'maker',
         now() - interval '2 day 23 hour',
         'user-maya-checker-001',
         'checker',
         now() - interval '2 day',
         now() - interval '2 day',
         null
       )
     on conflict (batch_id) do update
     set bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_id = excluded.corporate_id,
         created_by_user_id = excluded.created_by_user_id,
         created_by_role = excluded.created_by_role,
         title = excluded.title,
         tag = excluded.tag,
         remark = excluded.remark,
         state = excluded.state,
         total_amount = excluded.total_amount,
         approval_comment = excluded.approval_comment,
         bank_reference = excluded.bank_reference,
         created_at = excluded.created_at,
         submitted_at = excluded.submitted_at,
         submitted_by_user_id = excluded.submitted_by_user_id,
         submitted_by_role = excluded.submitted_by_role,
         approved_at = excluded.approved_at,
         approved_by_user_id = excluded.approved_by_user_id,
         approved_by_role = excluded.approved_by_role,
         dispatched_at = excluded.dispatched_at,
         completed_at = excluded.completed_at,
         failure_reason = excluded.failure_reason`
  );

  await db.query(
    `insert into payout_items (
       item_id, batch_id, beneficiary_id, amount, currency, purpose,
       state, bank_reference, failure_reason, processed_at
     )
     values
       (
         'item-acme-001',
         'batch-acme-001',
         'ben-acme-001',
         125000.00,
         'INR',
         'April vendor settlement',
         'pending',
         null,
         null,
         null
       ),
       (
         'item-acme-002',
         'batch-acme-002',
         'ben-acme-001',
         48000.00,
         'INR',
         'Completed utility settlement',
         'processed',
         'BANKALPHA-DISP-BATCHACME002-ITEM-ACME-002',
         null,
         now() - interval '2 day'
       )
     on conflict (item_id) do update
     set batch_id = excluded.batch_id,
         beneficiary_id = excluded.beneficiary_id,
         amount = excluded.amount,
         currency = excluded.currency,
         purpose = excluded.purpose,
         state = excluded.state,
         bank_reference = excluded.bank_reference,
         failure_reason = excluded.failure_reason,
         processed_at = excluded.processed_at`
  );

  await db.query(
    `insert into corporate_roles (
       role_id, corporate_tenant_id, name, description, status, permissions, approval_state, review_comment
     )
     values
       (
         'role-maya-maker',
         $1,
         'maker',
         'Can create and submit payout transactions',
         'active',
         array['transaction.create','transaction.submit','beneficiary.create','role.create','user.create'],
         'approved',
         'Seeded maker role'
       ),
       (
         'role-maya-checker',
         $1,
         'checker',
         'Can review and approve maker requests',
         'active',
         array['transaction.approve','beneficiary.approve','role.approve','user.approve'],
         'approved',
         'Seeded checker role'
       )
     on conflict (role_id) do update
     set corporate_tenant_id = excluded.corporate_tenant_id,
         name = excluded.name,
         description = excluded.description,
         status = excluded.status,
         permissions = excluded.permissions,
         approval_state = excluded.approval_state,
         review_comment = excluded.review_comment`,
    [mayaCorporateTenantId]
  );

  await db.query(
    `insert into corporate_users (
       user_id, username, password, display_name, role, bank_tenant_id,
       corporate_tenant_id, corporate_id, status, approval_state, review_comment
     )
     values
       (
         'user-maya-maker-001',
         'grvmaker',
         '9771',
         'GRV Maker',
         'maker',
         $1,
         $2,
         $3,
         'active',
         'approved',
         'Seeded maker user'
       ),
       (
         'user-maya-checker-001',
         'grvchecker',
         '9771',
         'GRV Checker',
         'checker',
         $1,
         $2,
         $3,
         'active',
         'approved',
         'Seeded checker user'
       )
     on conflict (username) do update
     set password = excluded.password,
         display_name = excluded.display_name,
         role = excluded.role,
         bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_id = excluded.corporate_id,
         status = excluded.status,
         approval_state = excluded.approval_state,
         review_comment = excluded.review_comment`,
    [mayaBankTenantId, mayaCorporateTenantId, mayaCorporateId]
  );

  await db.query(
    `insert into partner_api_keys (
       key_id, label, product_scope, api_key, status, created_by, created_at, revoked_at
     )
     values
       (
         'seed-partner-key-001',
         'Seeded partner key',
         'all',
         $1,
         'active',
         'system',
         now(),
         null
       )
     on conflict (key_id) do update
     set label = excluded.label,
         product_scope = excluded.product_scope,
         api_key = excluded.api_key,
         status = excluded.status,
         created_by = excluded.created_by,
         revoked_at = excluded.revoked_at`,
    [config.beneficiaryPublishApiKey]
  );

  console.log("database seed complete");
  await db.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
