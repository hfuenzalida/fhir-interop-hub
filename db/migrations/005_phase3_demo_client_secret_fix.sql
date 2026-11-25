-- Fix demo SMART client secret hash if migration 004 ran with an incorrect placeholder.
-- Plaintext secret remains: demo-smart-secret (SHA-256 hex below).

UPDATE oauth_client
SET client_secret_hash = 'dab4fddf8ad62281a786d81aafd97fb70f3aa50eb9d46a5ad245a7f210150d9e'
WHERE client_id = 'demo-smart-app';
