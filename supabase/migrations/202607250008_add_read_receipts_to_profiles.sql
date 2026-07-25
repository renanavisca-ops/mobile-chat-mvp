-- Per-user privacy preference: when false, this user's client never sends read
-- receipts (senders see "delivered" but never "read"). Mirrors profiles.show_online.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS read_receipts boolean NOT NULL DEFAULT true;
