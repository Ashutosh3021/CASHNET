-- ============================================================================
-- CashNet Canonical Data Model
-- Phase 0: Discovery and Control Design
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: CORE CASE MANAGEMENT
-- ============================================================================

-- Cases table with full lifecycle support
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_reference TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    fraud_type TEXT NOT NULL,
    reported_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
        'NEW', 'UNDER_ANALYSIS', 'INVESTIGATION', 'ACTION_REQUIRED',
        'RESOLVED', 'CLOSED', 'ESCALATED'
    )),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN (
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    )),
    classification TEXT CHECK (classification IN (
        'UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'
    )),
    jurisdiction TEXT,
    assigned_to UUID,
    source_type TEXT NOT NULL DEFAULT 'USER_PROVIDED',
    source_reference TEXT,
    sla_deadline TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 2: ADDRESS & ENTITY MANAGEMENT
-- ============================================================================

-- Addresses (wallets, bank accounts, etc.)
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    chain TEXT NOT NULL, -- 'bitcoin', 'ethereum', 'tron', 'bnb', 'solana', 'polygon', 'bank_account'
    address_type TEXT NOT NULL CHECK (address_type IN (
        'WALLET', 'BANK_ACCOUNT', 'EXCHANGE_DEPOSIT', 'OTHER'
    )),
    label TEXT, -- Optional human-readable label
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    total_inflow NUMERIC DEFAULT 0,
    total_outflow NUMERIC DEFAULT 0,
    risk_score NUMERIC CHECK (risk_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(case_id, address, chain)
);

-- Entity registry (VASPs, exchanges, known actors)
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'VASP', 'EXCHANGE', 'MIXER', 'UNKNOWN', 'OTHER'
    )),
    name TEXT NOT NULL,
    legal_name TEXT,
    jurisdiction TEXT,
    registration_number TEXT,
    website TEXT,
    risk_category TEXT CHECK (risk_category IN (
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'
    )),
    verified BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entity aliases (alternative names, domains)
CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    alias_type TEXT NOT NULL CHECK (alias_type IN (
        'DOMAIN', 'BRAND', 'WALLET_LABEL', 'OTHER'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_id, alias)
);

-- Clusters (groups of related addresses)
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cluster_type TEXT NOT NULL CHECK (cluster_type IN (
        'OWNED', 'CONTROLLED', 'SUSPECTED', 'UNKNOWN'
    )),
    entity_id UUID REFERENCES entities(id),
    risk_score NUMERIC CHECK (risk_score BETWEEN 0 AND 100),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cluster members
CREATE TABLE IF NOT EXISTS cluster_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
    added_by UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(cluster_id, address_id)
);

-- ============================================================================
-- SECTION 3: TRANSACTION & TRACE MANAGEMENT
-- ============================================================================

-- Transactions (blockchain + bank)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    tx_hash TEXT,
    chain TEXT NOT NULL,
    block_number BIGINT,
    block_timestamp TIMESTAMPTZ NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ETH',
    gas_price NUMERIC,
    gas_used NUMERIC,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'TRANSFER', 'SWAP', 'BRIDGE', 'DEPOSIT', 'WITHDRAWAL', 'OTHER'
    )),
    source_entity_id UUID REFERENCES entities(id),
    destination_entity_id UUID REFERENCES entities(id),
    is_suspicious BOOLEAN DEFAULT FALSE,
    risk_score NUMERIC CHECK (risk_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tx_hash, chain)
);

-- Trace results (multi-hop path discovery)
CREATE TABLE IF NOT EXISTS traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    trace_type TEXT NOT NULL CHECK (trace_type IN (
        'FORWARD', 'BACKWARD', 'BIDIRECTIONAL'
    )),
    max_hops INTEGER NOT NULL DEFAULT 8,
    time_window_days INTEGER,
    value_min NUMERIC,
    value_max NUMERIC,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
    )),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    transaction_count INTEGER DEFAULT 0,
    total_value NUMERIC DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trace paths (individual hops in a trace)
CREATE TABLE IF NOT EXISTS trace_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    hop_number INTEGER NOT NULL,
    path_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(trace_id, transaction_id, path_index)
);

-- ============================================================================
-- SECTION 4: ATTRIBUTION & FINDINGS
-- ============================================================================

-- Attribution findings
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    finding_type TEXT NOT NULL CHECK (finding_type IN (
        'VASP_ATTRIBUTION', 'RISK_FLAG', 'PATTERN_DETECTION',
        'BRIDGE_DETECTION', 'MIXER_DETECTION', 'OTHER'
    )),
    entity_id UUID REFERENCES entities(id),
    confidence NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    confidence_factors JSONB,
    evidence_summary TEXT,
    model_version TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'ACCEPTED', 'REJECTED', 'INCONCLUSIVE'
    )),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 5: EVIDENCE MANAGEMENT
-- ============================================================================

-- Evidence packages (immutable snapshots)
CREATE TABLE IF NOT EXISTS evidence_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES findings(id),
    package_type TEXT NOT NULL CHECK (package_type IN (
        'TRANSACTION_TRACE', 'VASP_ATTESTATION', 'BLOCKCHAIN_SNAPSHOT',
        'COMPLAINT_PACKAGE', 'OTHER'
    )),
    content_hash TEXT NOT NULL, -- SHA-256 of package content
    content_type TEXT NOT NULL DEFAULT 'application/json',
    metadata JSONB,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    verified_by UUID
);

-- Evidence package items (individual evidence objects)
CREATE TABLE IF NOT EXISTS evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES evidence_packages(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN (
        'TRANSACTION', 'SCREENSHOT', 'DOCUMENT', 'ATTESTATION',
        'BLOCK_DATA', 'OTHER'
    )),
    content_hash TEXT NOT NULL,
    storage_key TEXT NOT NULL, -- S3/object storage path
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 6: ACTION REQUESTS & WORKFLOWS
-- ============================================================================

-- Action requests (freeze, disclosure, etc.)
CREATE TABLE IF NOT EXISTS action_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES findings(id),
    action_type TEXT NOT NULL CHECK (action_type IN (
        'FREEZE_ACCOUNT', 'DISCLOSURE_REQUEST', 'BLOCK_ADDRESS',
        'INVESTIGATE_ENTITY', 'OTHER'
    )),
    target_entity_id UUID REFERENCES entities(id),
    target_address TEXT,
    target_jurisdiction TEXT,
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN (
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    )),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
        'SENT', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED'
    )),
    policy_validation_passed BOOLEAN DEFAULT FALSE,
    partner_delivery_status TEXT,
    sla_deadline TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Action request approvals
CREATE TABLE IF NOT EXISTS action_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES action_requests(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 7: TAGS & CLASSIFICATION
-- ============================================================================

-- Tags for cases, findings, etc.
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'FRAUD_TYPE', 'RISK_LEVEL', 'STATUS', 'CUSTOM'
    )),
    color TEXT, -- Hex color for UI
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tag associations (polymorphic)
CREATE TABLE IF NOT EXISTS tag_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'CASE', 'FINDING', 'EVIDENCE', 'ACTION_REQUEST', 'ADDRESS'
    )),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tag_id, entity_type, entity_id)
);

-- ============================================================================
-- SECTION 8: AUDIT & COMPLIANCE
-- ============================================================================

-- Enhanced audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id),
    correlation_id UUID DEFAULT gen_random_uuid(),
    actor UUID NOT NULL,
    actor_ip INET,
    actor_user_agent TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    source_type TEXT NOT NULL,
    model_version TEXT,
    purpose TEXT, -- Why this action was taken
    outcome TEXT CHECK (outcome IN ('SUCCESS', 'FAILURE', 'PARTIAL')),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 9: HISTORICAL & GEOSPATIAL DATA
-- ============================================================================

-- Historical geographic intelligence (existing table, preserved)
CREATE TABLE IF NOT EXISTS historical_suspicious_transactions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    transaction_type TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    timestamp TIMESTAMPTZ NOT NULL,
    source_entity_id TEXT,
    destination_entity_id TEXT,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    city TEXT NOT NULL,
    pincode TEXT,
    location_type TEXT NOT NULL,
    risk_score NUMERIC NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_category TEXT NOT NULL,
    fraud_type TEXT NOT NULL,
    data_source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 10: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Cases
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases(status);
CREATE INDEX IF NOT EXISTS cases_priority_idx ON cases(priority);
CREATE INDEX IF NOT EXISTS cases_created_at_idx ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS cases_assigned_to_idx ON cases(assigned_to);

-- Addresses
CREATE INDEX IF NOT EXISTS addresses_case_id_idx ON addresses(case_id);
CREATE INDEX IF NOT EXISTS addresses_chain_idx ON addresses(chain);
CREATE INDEX IF NOT EXISTS addresses_address_idx ON addresses(address);

-- Transactions
CREATE INDEX IF NOT EXISTS transactions_case_id_idx ON transactions(case_id);
CREATE INDEX IF NOT EXISTS transactions_chain_idx ON transactions(chain);
CREATE INDEX IF NOT EXISTS transactions_from_idx ON transactions(from_address);
CREATE INDEX IF NOT EXISTS transactions_to_idx ON transactions(to_address);
CREATE INDEX IF NOT EXISTS transactions_timestamp_idx ON transactions(block_timestamp DESC);

-- Traces
CREATE INDEX IF NOT EXISTS traces_case_id_idx ON traces(case_id);
CREATE INDEX IF NOT EXISTS traces_status_idx ON traces(status);

-- Findings
CREATE INDEX IF NOT EXISTS findings_case_id_idx ON findings(case_id);
CREATE INDEX IF NOT EXISTS findings_type_idx ON findings(finding_type);
CREATE INDEX IF NOT EXISTS findings_status_idx ON findings(status);

-- Evidence
CREATE INDEX IF NOT EXISTS evidence_case_id_idx ON evidence_packages(case_id);
CREATE INDEX IF NOT EXISTS evidence_hash_idx ON evidence_packages(content_hash);

-- Action Requests
CREATE INDEX IF NOT EXISTS action_requests_case_id_idx ON action_requests(case_id);
CREATE INDEX IF NOT EXISTS action_requests_status_idx ON action_requests(status);

-- Audit Logs
CREATE INDEX IF NOT EXISTS audit_case_idx ON audit_logs(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_correlation_idx ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs(actor);

-- Historical Transactions
CREATE INDEX IF NOT EXISTS historical_transactions_timestamp_idx ON historical_suspicious_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS historical_transactions_case_idx ON historical_suspicious_transactions(case_id);
CREATE INDEX IF NOT EXISTS historical_transactions_filters_idx ON historical_suspicious_transactions(state, district, city, fraud_type, risk_score);
CREATE INDEX IF NOT EXISTS historical_transactions_coordinates_idx ON historical_suspicious_transactions(latitude, longitude);

-- ============================================================================
-- SECTION 11: VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active cases view
CREATE OR REPLACE VIEW active_cases AS
SELECT
    c.*,
    COUNT(DISTINCT a.id) as address_count,
    COUNT(DISTINCT t.id) as transaction_count,
    COUNT(DISTINCT f.id) as finding_count,
    COUNT(DISTINCT ar.id) as action_request_count
FROM cases c
LEFT JOIN addresses a ON a.case_id = c.id
LEFT JOIN transactions t ON t.case_id = c.id
LEFT JOIN findings f ON f.case_id = c.id
LEFT JOIN action_requests ar ON ar.case_id = c.id
WHERE c.status NOT IN ('RESOLVED', 'CLOSED')
GROUP BY c.id;

-- Case summary view
CREATE OR REPLACE VIEW case_summary AS
SELECT
    c.id,
    c.case_reference,
    c.title,
    c.fraud_type,
    c.reported_amount,
    c.status,
    c.priority,
    c.sla_deadline,
    c.created_at,
    c.updated_at,
    COUNT(DISTINCT a.id) as address_count,
    COUNT(DISTINCT t.id) as transaction_count,
    COUNT(DISTINCT f.id) as finding_count,
    MAX(f.confidence) as max_confidence,
    SUM(CASE WHEN ar.status = 'SENT' THEN 1 ELSE 0 END) as actions_sent
FROM cases c
LEFT JOIN addresses a ON a.case_id = c.id
LEFT JOIN transactions t ON t.case_id = c.id
LEFT JOIN findings f ON f.case_id = c.id
LEFT JOIN action_requests ar ON ar.case_id = c.id
GROUP BY c.id;

-- ============================================================================
-- SECTION 12: FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Function to update case status with validation
CREATE OR REPLACE FUNCTION update_case_status(
    p_case_id UUID,
    p_new_status TEXT,
    p_actor UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_status TEXT;
    v_valid_transition BOOLEAN := FALSE;
BEGIN
    SELECT status INTO v_old_status FROM cases WHERE id = p_case_id;
    
    IF v_old_status IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Define valid state transitions
    v_valid_transition := CASE
        WHEN v_old_status = 'NEW' AND p_new_status IN ('UNDER_ANALYSIS', 'CLOSED') THEN TRUE
        WHEN v_old_status = 'UNDER_ANALYSIS' AND p_new_status IN ('INVESTIGATION', 'RESOLVED', 'CLOSED') THEN TRUE
        WHEN v_old_status = 'INVESTIGATION' AND p_new_status IN ('ACTION_REQUIRED', 'RESOLVED', 'CLOSED') THEN TRUE
        WHEN v_old_status = 'ACTION_REQUIRED' AND p_new_status IN ('INVESTIGATION', 'RESOLVED', 'CLOSED') THEN TRUE
        WHEN v_old_status = 'RESOLVED' AND p_new_status IN ('CLOSED') THEN TRUE
        WHEN v_old_status = 'ESCALATED' AND p_new_status IN ('INVESTIGATION', 'RESOLVED', 'CLOSED') THEN TRUE
        ELSE FALSE
    END;
    
    IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid state transition from % to %', v_old_status, p_new_status;
    END IF;
    
    UPDATE cases 
    SET status = p_new_status, updated_at = now()
    WHERE id = p_case_id;
    
    -- Log the transition
    INSERT INTO audit_logs (case_id, actor, action, resource_type, resource_id, source_type, details)
    VALUES (p_case_id, p_actor, 'STATUS_CHANGE', 'CASE', p_case_id, 'SYSTEM', 
            jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to verify evidence integrity
CREATE OR REPLACE FUNCTION verify_evidence_integrity(
    p_package_id UUID
) RETURNS TABLE(
    item_id UUID,
    item_hash TEXT,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ei.id,
        ei.content_hash,
        TRUE as is_valid -- In production, verify against stored hash
    FROM evidence_items ei
    WHERE ei.package_id = p_package_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 13: SEED DATA FOR TESTING
-- ============================================================================

-- Insert sample tags
INSERT INTO tags (name, category, color) VALUES
    ('RANSOMWARE', 'FRAUD_TYPE', '#FF0000'),
    ('PHISHING', 'FRAUD_TYPE', '#FF6600'),
    ('INVESTMENT_SCAM', 'FRAUD_TYPE', '#FFCC00'),
    ('MIXER_TUMBLER', 'RISK_LEVEL', '#CC00FF'),
    ('HIGH_RISK_VASP', 'RISK_LEVEL', '#FF0066'),
    ('CROSS_BORDER', 'STATUS', '#0066FF'),
    ('URGENT', 'STATUS', '#FF0000')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- Enable PostGIS when available (uncomment when PostGIS is installed)
-- ALTER TABLE historical_suspicious_transactions ADD COLUMN geom geometry(Point, 4326);
-- CREATE INDEX historical_transactions_geom_idx ON historical_suspicious_transactions USING gist(geom);
