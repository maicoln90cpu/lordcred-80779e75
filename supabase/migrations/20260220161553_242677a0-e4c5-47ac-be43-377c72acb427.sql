-- Confirm email for silascarlosdias@gmail.com
UPDATE auth.users 
SET email_confirmed_at = now(),
    updated_at = now()
WHERE id = '69c1cf93-b3b4-45b0-8af7-9380f9d5b92a';