with ranked_corporates as (
  select
    corporate_id,
    corporate_tenant_id,
    row_number() over (
      partition by corporate_tenant_id, lower(name)
      order by
        case when corporate_id like 'co-%' then 0 else 1 end,
        corporate_id
    ) as row_rank
  from corporates
  where corporate_tenant_id in (
    select tenant_id
    from corporate_tenants
    where lower(name) like '%maya%' or lower(legal_entity_name) like '%maya%'
  )
)
delete from corporates
where corporate_id in (
  select corporate_id
  from ranked_corporates
  where row_rank > 1
);

delete from corporates
where corporate_id in (
  select duplicate_seed.corporate_id
  from corporates duplicate_seed
  join corporate_tenants tenant
    on tenant.tenant_id = duplicate_seed.corporate_tenant_id
  where (lower(tenant.name) like '%maya%' or lower(tenant.legal_entity_name) like '%maya%')
    and lower(duplicate_seed.name) like '%pharama%'
    and exists (
      select 1
      from corporates canonical
      where canonical.corporate_tenant_id = duplicate_seed.corporate_tenant_id
        and lower(canonical.name) like '%maya pharma%'
        and canonical.corporate_id <> duplicate_seed.corporate_id
    )
);
