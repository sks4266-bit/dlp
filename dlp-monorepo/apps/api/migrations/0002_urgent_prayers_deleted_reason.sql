-- Add deleted_reason for admin deletion logs
ALTER TABLE urgent_prayers ADD COLUMN deleted_reason TEXT;
