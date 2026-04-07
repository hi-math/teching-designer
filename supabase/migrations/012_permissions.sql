-- Add permissions JSONB column to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"phaseNav":false,"complete":true,"skip":true,"opinion":true,"titleEdit":false}'::jsonb;
