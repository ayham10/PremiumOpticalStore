-- Clinic bookings: make public.appointments the relational source of truth.
-- Safe to run on production where public.appointments is currently empty.
-- Does NOT drop public.eye_exam_appointments or modify lumina_store payload data.

-- 1) Allow text IDs (preserve eea_* ids from lumina_store JSON)
alter table public.sms_logs
  drop constraint if exists sms_logs_appointment_id_fkey;

alter table public.appointments
  alter column id drop default;

alter table public.appointments
  alter column id type text using id::text;

alter table public.sms_logs
  alter column appointment_id type text using appointment_id::text;

alter table public.sms_logs
  add constraint sms_logs_appointment_id_fkey
  foreign key (appointment_id) references public.appointments(id)
  on delete set null;

-- 2) Clinic bookings are not staff-assigned
alter table public.appointments
  alter column staff_id drop not null;

alter table public.appointments
  alter column customer_id drop not null;

-- 3) Required clinic metadata
alter table public.appointments
  add column if not exists language text not null default 'en';

alter table public.appointments
  add column if not exists sms_status text;

alter table public.appointments
  add column if not exists sms_error text;

-- 4) Status set includes clinic statuses
alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (
    status in (
      'pending',
      'confirmed',
      'cancelled',
      'completed',
      'rescheduled',
      'no-show'
    )
  );

-- 5) Unique active slot per service + date + time (user requirement)
drop index if exists appointments_no_overlap_idx;

create unique index if not exists appointments_active_service_slot_idx
  on public.appointments (service, appointment_date, start_time)
  where status <> 'cancelled';

-- 6) Preserve shared-calendar behaviour for clinic rows (no staff):
--    one active booking per date+time when staff_id is null.
create unique index if not exists appointments_active_clinic_slot_idx
  on public.appointments (appointment_date, start_time)
  where status <> 'cancelled' and staff_id is null;

-- 7) Helpful lookup indexes
create index if not exists appointments_date_idx
  on public.appointments (appointment_date);

create index if not exists appointments_status_idx
  on public.appointments (status);

create index if not exists appointments_service_idx
  on public.appointments (service);

-- 8) eye_exam_appointments remains in schema but is obsolete for the app.
--    Do not drop until production verification is complete.
comment on table public.eye_exam_appointments is
  'OBSOLETE for app runtime. Clinic bookings use public.appointments. Keep until verified.';

comment on table public.appointments is
  'Source of truth for clinic and staff appointments. Clinic services: eye_exam, contact_lens_fitting, frame_consultation, sunglasses_consultation.';
