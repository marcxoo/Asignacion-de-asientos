-- Without a primary key, Supabase Realtime requires FULL replica identity
-- to allow UPDATE/DELETE on published tables.

ALTER TABLE assignments REPLICA IDENTITY FULL;
