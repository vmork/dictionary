CREATE TABLE auth_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL,
  image text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);

CREATE TABLE auth_accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL
);

CREATE INDEX auth_accounts_user_id_idx ON auth_accounts(user_id);

CREATE TABLE auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX auth_verifications_identifier_idx ON auth_verifications(identifier);

CREATE TABLE auth_rate_limits (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  last_request bigint NOT NULL
);

ALTER TABLE collections ADD COLUMN owner_id text;

ALTER TABLE collections
  ADD CONSTRAINT collections_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE RESTRICT;

ALTER TABLE collections DROP CONSTRAINT collections_name_key;
ALTER TABLE collections ADD CONSTRAINT collections_owner_name_key UNIQUE (owner_id, name);

ALTER TABLE words DROP CONSTRAINT words_word_key;
ALTER TABLE words ADD CONSTRAINT words_collection_word_key UNIQUE (collection_id, word);
