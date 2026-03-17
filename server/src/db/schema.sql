-- SME Finder Tool — Database Schema
-- Requires PostgreSQL 15+ (uses gen_random_uuid, gen_random_bytes)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Users (proposal managers and viewers)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          VARCHAR(30) NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('proposal_manager', 'viewer', 'admin')),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SME Directory
-- ============================================================
CREATE TABLE IF NOT EXISTS smes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   VARCHAR(255) NOT NULL,
  -- NIS/corporate email (may not be monitored by remote SMEs)
  nis_email              VARCHAR(255),
  -- Federal/client-side email the SME actually checks day-to-day
  federal_email          VARCHAR(255),
  -- NIS Teams UPN for @mentions
  teams_id               VARCHAR(255),
  -- Project Manager: intermediary who reliably monitors NIS channels
  pm_name                VARCHAR(255),
  pm_email               VARCHAR(255),
  pm_teams_id            VARCHAR(255),
  -- Notification routing
  -- 'sme_only' = send to federal_email (fallback: nis_email)
  -- 'pm_only'  = route entirely through PM (good for hard-to-reach remote SMEs)
  -- 'both'     = send to SME and CC PM
  notify_routing         VARCHAR(10) NOT NULL DEFAULT 'both'
                           CHECK (notify_routing IN ('sme_only', 'pm_only', 'both')),
  skillsets              TEXT[] NOT NULL DEFAULT '{}',
  certifications         TEXT[] NOT NULL DEFAULT '{}',
  contract_title         VARCHAR(255),
  position               VARCHAR(255),
  job_description        TEXT,
  clearance_level        VARCHAR(100),
  contact_availability   VARCHAR(30) NOT NULL DEFAULT 'no'
                           CHECK (contact_availability IN ('no', 'yes (business hour)', 'yes (lunchtime)', 'yes (afterhour)')),
  preferred_contact      VARCHAR(10) NOT NULL DEFAULT 'email'
                           CHECK (preferred_contact IN ('email', 'teams', 'call')),
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  avg_rating             NUMERIC(3,2),
  rating_count           INT NOT NULL DEFAULT 0,
  created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SME Requests
-- ============================================================
CREATE TABLE IF NOT EXISTS sme_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_name VARCHAR(255) NOT NULL,
  topic            TEXT NOT NULL,
  due_date         DATE NOT NULL,
  assigned_sme_id  UUID REFERENCES smes(id) ON DELETE SET NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending', 'accepted', 'in_progress',
                       'completed', 'declined', 'overdue'
                     )),
  -- Unique token used in one-click Accept/Decline links (no auth required)
  response_token   VARCHAR(64) UNIQUE NOT NULL
                     DEFAULT encode(gen_random_bytes(32), 'hex'),
  decline_reason   TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Notification Log (audit trail for every outbound message)
-- ============================================================
CREATE TABLE IF NOT EXISTS sme_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID REFERENCES sme_requests(id) ON DELETE CASCADE,
  sme_id       UUID REFERENCES smes(id) ON DELETE SET NULL,
  type         VARCHAR(30) NOT NULL
                 CHECK (type IN (
                   'initial_request', 'reminder_2day', 'reminder_1day',
                   'overdue_alert', 'escalation', 'rating_request'
                 )),
  channel      VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'teams')),
  recipients   TEXT,               -- comma-separated list of emails/IDs sent to
  status       VARCHAR(10) NOT NULL DEFAULT 'sent'
                 CHECK (status IN ('sent', 'failed', 'skipped')),
  error_detail TEXT,
  sent_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SME Usefulness Ratings (post-completion, optional)
-- ============================================================
CREATE TABLE IF NOT EXISTS sme_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES sme_requests(id) ON DELETE CASCADE,
  sme_id     UUID REFERENCES smes(id) ON DELETE CASCADE,
  rating     INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  notes      TEXT,
  rated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  rated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Trigger: keep smes.avg_rating + rating_count up to date
-- ============================================================
CREATE OR REPLACE FUNCTION update_sme_avg_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE smes
  SET
    avg_rating   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM sme_ratings WHERE sme_id = NEW.sme_id),
    rating_count = (SELECT COUNT(*) FROM sme_ratings WHERE sme_id = NEW.sme_id),
    updated_at   = NOW()
  WHERE id = NEW.sme_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_rating_insert
AFTER INSERT ON sme_ratings
FOR EACH ROW EXECUTE FUNCTION update_sme_avg_rating();

-- ============================================================
-- Trigger: auto-update updated_at on sme_requests and smes
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER smes_updated_at
BEFORE UPDATE ON smes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sme_requests_updated_at
BEFORE UPDATE ON sme_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Migrations: safe to run on existing installs
-- ============================================================
DO $$ BEGIN
  -- Add contact_availability if missing (replaces ok_to_contact_directly)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smes' AND column_name = 'contact_availability'
  ) THEN
    ALTER TABLE smes ADD COLUMN contact_availability VARCHAR(30) NOT NULL DEFAULT 'no';
    -- Migrate existing boolean data
    UPDATE smes SET contact_availability = CASE WHEN ok_to_contact_directly THEN 'yes (business hour)' ELSE 'no' END;
  END IF;
END $$;

DO $$ DECLARE v_con TEXT; BEGIN
  -- Expand preferred_contact to allow 'call'
  SELECT conname INTO v_con FROM pg_constraint
    WHERE conrelid = 'smes'::regclass AND contype = 'c' AND conname LIKE '%preferred_contact%';
  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE smes DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
  BEGIN
    ALTER TABLE smes ADD CONSTRAINT smes_preferred_contact_check
      CHECK (preferred_contact IN ('email', 'teams', 'call'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
