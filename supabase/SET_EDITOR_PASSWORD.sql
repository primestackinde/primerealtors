-- Set a known password for the editor account (Supabase's documented recipe).
-- EDIT LINE 4: replace CHANGE-ME-Strong-Password1! with the password you want
-- (at least 6 characters). Keep the quotes around it.
-- Run: expect "UPDATE 1" and one proof row with confirmed = true.

update auth.users
set encrypted_password = crypt('CHANGE-ME-Strong-Password1!', gen_salt('bf'))
where email = 'primestack02@gmail.com';

select email,
       encrypted_password is not null as has_password,
       email_confirmed_at is not null as confirmed
from auth.users
where email = 'primestack02@gmail.com';
