import { loadConfig } from "../../packages/shared/src/config.js";
import { getDatabasePool } from "../../packages/shared/src/db.js";
import { hashPassword } from "../../packages/shared/src/crypto.js";

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
         array[
           'transaction.make',
           'beneficiary.make',
           'roles.make',
           'user.make',
           'devportal.view',
           'settings.view',
           'settings.edit'
         ],
         'approved',
         'Seeded maker role'
       ),
       (
         'role-maya-checker',
         $1,
         'checker',
         'Can review and approve maker requests',
         'active',
         array[
           'transaction.checker',
           'beneficiary.checker',
           'roles.checker',
           'user.checker',
           'devportal.view',
           'settings.view',
           'settings.edit'
         ],
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
    `insert into payment_methods (
       payment_method_code, name, rail_family, settlement_mode, weekend_support,
       min_amount, max_amount, status, created_at, updated_at
     )
     values
       ('NEFT', 'National Electronic Funds Transfer', 'bank_transfer', 'batch', true, 1, 500000000, 'active', now(), now()),
       ('RTGS', 'Real Time Gross Settlement', 'bank_transfer', 'real_time', false, 200000, 500000000, 'active', now(), now()),
       ('IMPS', 'Immediate Payment Service', 'real_time_transfer', 'real_time', true, 1, 500000, 'active', now(), now()),
       ('UPI', 'Unified Payments Interface', 'real_time_transfer', 'real_time', true, 1, 100000, 'active', now(), now()),
       ('NACH', 'National Automated Clearing House', 'batch_debit', 'batch', false, 1, 10000000, 'active', now(), now())
     on conflict (payment_method_code) do update
     set name = excluded.name,
         rail_family = excluded.rail_family,
         settlement_mode = excluded.settlement_mode,
         weekend_support = excluded.weekend_support,
         min_amount = excluded.min_amount,
         max_amount = excluded.max_amount,
         status = excluded.status,
         updated_at = now()`
  );

  await db.query(
    `insert into packages (
       package_id, owner_type, bank_tenant_id, corporate_tenant_id, corporate_id, base_package_code,
       package_code, name, use_case, description,
       allowed_beneficiary_types, bulk_approve_enabled, debit_modes_allowed,
       default_debit_mode, file_rejection_modes_allowed, default_file_rejection_mode,
       default_payment_method_code, max_payments_per_batch, pricing_defaults_json, status, created_at, updated_at
     )
     values
       (
         'pkg-bank-alpha-venpay',
         'bank',
         'bank-alpha',
         null,
         null,
         null,
         'VENPAY',
         'Venpay',
         'vendor_payments',
         'Vendor payments package for accounts payable workflows.',
         array['vendor'],
         false,
         array['single'],
         'single',
         array['fail_full_file', 'reject_invalid_rows'],
         'fail_full_file',
         'NEFT',
         1000,
         '{"platformFee":"0","transactionFees":{"NEFT":"2.5","RTGS":"15","IMPS":"5"}}'::jsonb,
         'active',
         now(),
         now()
       )
     on conflict (package_id) do update
     set owner_type = excluded.owner_type,
         bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_id = excluded.corporate_id,
         base_package_code = excluded.base_package_code,
         name = excluded.name,
         use_case = excluded.use_case,
         description = excluded.description,
         allowed_beneficiary_types = excluded.allowed_beneficiary_types,
         bulk_approve_enabled = excluded.bulk_approve_enabled,
         debit_modes_allowed = excluded.debit_modes_allowed,
         default_debit_mode = excluded.default_debit_mode,
         file_rejection_modes_allowed = excluded.file_rejection_modes_allowed,
         default_file_rejection_mode = excluded.default_file_rejection_mode,
         default_payment_method_code = excluded.default_payment_method_code,
         max_payments_per_batch = excluded.max_payments_per_batch,
         pricing_defaults_json = excluded.pricing_defaults_json,
         status = excluded.status,
         updated_at = now()`
  );

  await db.query(
    `insert into package_payment_methods (
       package_id, payment_method_code, min_amount_override, max_amount_override,
       pricing_overrides_json, created_at
     )
     values
       ('pkg-bank-alpha-venpay', 'NEFT', 1, 500000000, '{"priority":"standard"}'::jsonb, now()),
       ('pkg-bank-alpha-venpay', 'RTGS', 200000, 500000000, '{"priority":"high_value"}'::jsonb, now()),
       ('pkg-bank-alpha-venpay', 'IMPS', 1, 500000, '{"priority":"instant"}'::jsonb, now()),
       ('pkg-bank-alpha-venpay', 'UPI', 1, 100000, '{"priority":"low_value"}'::jsonb, now())
     on conflict (package_id, payment_method_code) do update
     set min_amount_override = excluded.min_amount_override,
         max_amount_override = excluded.max_amount_override,
         pricing_overrides_json = excluded.pricing_overrides_json`
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
         $4,
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
         $5,
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
    [
      mayaBankTenantId,
      mayaCorporateTenantId,
      mayaCorporateId,
      hashPassword("9771"),
      hashPassword("9771")
    ]
  );

  await db.query(
    `insert into corporate_subscriptions (
       subscription_id, bank_tenant_id, corporate_tenant_id, corporate_id, package_id,
       package_code, display_name, status, started_at, suspended_at, terminated_at,
       created_by, updated_by, created_at, updated_at
     )
     values
       (
         'sub-maya-venpay-001',
         $1,
         $2,
         $3,
         'pkg-bank-alpha-venpay',
         'VENPAY',
         'Maya Pharma Venpay',
         'active',
         now(),
         null,
         null,
         'system',
         'system',
         now(),
         now()
       )
     on conflict (subscription_id) do update
     set bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_id = excluded.corporate_id,
         package_id = excluded.package_id,
         package_code = excluded.package_code,
         display_name = excluded.display_name,
         status = excluded.status,
         started_at = excluded.started_at,
         suspended_at = excluded.suspended_at,
         terminated_at = excluded.terminated_at,
         updated_by = excluded.updated_by,
         updated_at = now()`,
    [mayaBankTenantId, mayaCorporateTenantId, mayaCorporateId]
  );

  // Clear any existing default debit accounts for this corporate to avoid constraint violation
  await db.query(
    `update corporate_debit_accounts 
     set is_default = false 
     where bank_tenant_id = $1 and corporate_tenant_id = $2 and corporate_id = $3`,
    [mayaBankTenantId, mayaCorporateTenantId, mayaCorporateId]
  );

  await db.query(
    `insert into corporate_debit_accounts (
       debit_account_id, bank_tenant_id, corporate_tenant_id, corporate_id, account_name,
       account_number, ifsc, status, is_default, created_at, updated_at
     )
     values
       (
         'debit-maya-main-001',
         $1,
         $2,
         $3,
         'Maya Pharma Operating Account',
         '401234567890',
         'HDFC0001234',
         'active',
         true,
         now(),
         now()
       )
     on conflict (debit_account_id) do update
     set bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_id = excluded.corporate_id,
         account_name = excluded.account_name,
         account_number = excluded.account_number,
         ifsc = excluded.ifsc,
         status = excluded.status,
         is_default = excluded.is_default,
         updated_at = now()`,
    [mayaBankTenantId, mayaCorporateTenantId, mayaCorporateId]
  );

  await db.query(
    `insert into subscription_debit_accounts (
       subscription_id, debit_account_id, allowed_payment_method_codes, status, is_default, created_at
     )
     values
       (
         'sub-maya-venpay-001',
         'debit-maya-main-001',
         array['NEFT','RTGS','IMPS','UPI'],
         'active',
         true,
         now()
       )
     on conflict (subscription_id, debit_account_id) do update
     set allowed_payment_method_codes = excluded.allowed_payment_method_codes,
         status = excluded.status,
         is_default = excluded.is_default`
  );

  await db.query(
    `insert into corporate_subscription_preferences (
       subscription_id, preferred_debit_mode, preferred_file_rejection_mode,
       default_debit_account_id, payment_method_preferences_json, created_at, updated_at
     )
     values
       (
         'sub-maya-venpay-001',
         'single',
         'fail_full_file',
         'debit-maya-main-001',
         '{"preferredOrder":["IMPS","NEFT","RTGS","UPI"]}'::jsonb,
         now(),
         now()
       )
     on conflict (subscription_id) do update
     set preferred_debit_mode = excluded.preferred_debit_mode,
         preferred_file_rejection_mode = excluded.preferred_file_rejection_mode,
         default_debit_account_id = excluded.default_debit_account_id,
         payment_method_preferences_json = excluded.payment_method_preferences_json,
         updated_at = now()`
  );

  // Deactivate any existing active subscription user access records for these users to avoid constraint violation
  await db.query(
    `update subscription_user_access 
     set status = 'inactive' 
     where user_id in ('user-maya-maker-001', 'user-maya-checker-001')`
  );

  await db.query(
    `insert into subscription_user_access (
       access_id, subscription_id, user_id, role_name, status, created_at, updated_at
     )
     values
       (
         'sub-maya-venpay-maker-001',
         'sub-maya-venpay-001',
         'user-maya-maker-001',
         'maker',
         'active',
         now(),
         now()
       ),
       (
         'sub-maya-venpay-checker-001',
         'sub-maya-venpay-001',
         'user-maya-checker-001',
         'checker',
         'active',
         now(),
         now()
       )
     on conflict (access_id) do update
     set subscription_id = excluded.subscription_id,
         user_id = excluded.user_id,
         role_name = excluded.role_name,
         status = excluded.status,
         updated_at = now()`
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
