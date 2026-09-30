/*
# Add Job Deadline and Extended Transparency Columns

1. Schema Changes
  - `jobs`:
    - `last_date_to_apply` (timestamptz) - application deadline for the job
    - `salary_type` (text) - 'monthly' or 'annual'
    - `salary_basis` (text) - 'ctc', 'gross', or 'take_home'
    - `shift` (text) - 'Day', 'Night', 'Rotational', 'General', 'Flexible'
    - `meals_provided` (boolean DEFAULT false)
    - `overtime_available` (boolean DEFAULT false)
    - `joining_bonus_available` (boolean DEFAULT false)
    - `joining_bonus_amount` (numeric(10,2))
  - `profiles`:
    - `profile_photo` (text) - storage path for nurse passport photo
    - `avatar_url` (text) - signed or public URL for nurse passport photo
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_date_to_apply timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_type text DEFAULT 'monthly';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_basis text DEFAULT 'ctc';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shift text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS meals_provided boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS overtime_available boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS joining_bonus_available boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS joining_bonus_amount numeric(10,2);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
