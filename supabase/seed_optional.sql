-- ============================================================================
-- OPTIONAL SEED DATA — sample candidates for testing the UI/flow.
-- Safe to skip entirely for a real event. Run AFTER schema.sql.
-- Staff/user accounts are NOT seeded here: Supabase Auth users must be
-- created via the dashboard (see README.md "Add staff logins").
-- ============================================================================

insert into public.candidates
  (candidate_code, full_name, phone, email, position_applied, experience_years,
   resume_received, registration_complete, stage)
values
  ('WD-0001', 'Ananya Sharma',   '9810000001', 'ananya.s@example.com',  'Frontend Developer', 0,   true, true, 'reception'),
  ('WD-0002', 'Rohit Verma',     '9810000002', 'rohit.v@example.com',   'QA Engineer',         2.5, true, true, 'hr_screening'),
  ('WD-0003', 'Priya Nair',      '9810000003', 'priya.n@example.com',   'Backend Developer',   4,   true, true, 'cabin_1'),
  ('WD-0004', 'Karan Mehta',     '9810000004', 'karan.m@example.com',   'DevOps Engineer',     6,   true, true, 'cabin_4'),
  ('WD-0005', 'Sneha Iyer',      '9810000005', 'sneha.i@example.com',   'UI/UX Designer',      0,   true, true, 'loi'),
  ('WD-0006', 'Vikram Singh',    '9810000006', 'vikram.s@example.com',  'Data Analyst',        1,   true, true, 'completed'),
  ('WD-0007', 'Farah Khan',      '9810000007', 'farah.k@example.com',   'Frontend Developer',  0,   false, false, 'reception'),
  ('WD-0008', 'Aditya Rao',      '9810000008', 'aditya.r@example.com',  'Backend Developer',   3,   true, true, 'rejected');

update public.candidates
set rejected_at_stage = 'cabin_2', rejection_reason = 'Not a fit for current opening'
where candidate_code = 'WD-0008';

-- To wipe just this sample data later:
-- delete from public.candidates where candidate_code like 'WD-%';
