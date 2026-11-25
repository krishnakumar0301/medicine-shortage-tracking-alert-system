-- MedTrack reference schema (SQLite).
-- The application manages schema via SQLAlchemy; this file documents the tables.

PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      VARCHAR(80)  NOT NULL UNIQUE,
    email         VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(40)  NOT NULL DEFAULT 'admin',
    is_active     BOOLEAN      NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           VARCHAR(160) NOT NULL,
    contact_person VARCHAR(120),
    phone          VARCHAR(40),
    email          VARCHAR(160),
    address        TEXT,
    status         VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medicines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_code   VARCHAR(40)  NOT NULL UNIQUE,
    name            VARCHAR(160) NOT NULL,
    generic_name    VARCHAR(160),
    brand_name      VARCHAR(160),
    category        VARCHAR(80)  NOT NULL DEFAULT 'General',
    dosage_form     VARCHAR(60),
    strength        VARCHAR(60),
    unit            VARCHAR(20)  NOT NULL DEFAULT 'tablets',
    minimum_stock   INTEGER      NOT NULL DEFAULT 0,
    maximum_stock   INTEGER      NOT NULL DEFAULT 0,
    storage_location VARCHAR(80),
    selling_price   FLOAT,
    description     TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE INDEX ix_medicines_name ON medicines(name);
CREATE INDEX ix_medicines_category ON medicines(category);

CREATE TABLE batches (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id       INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    batch_number      VARCHAR(80) NOT NULL,
    manufacturing_date DATE,
    expiry_date       DATE,
    quantity          INTEGER NOT NULL DEFAULT 0,
    purchase_price    FLOAT,
    supplier_id       INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_batches_medicine_id ON batches(medicine_id);
CREATE INDEX ix_batches_expiry_date ON batches(expiry_date);
CREATE INDEX ix_batch_medicine_expiry ON batches(medicine_id, expiry_date);

CREATE TABLE stock_transactions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    batch_id         INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL,
    quantity         INTEGER NOT NULL,
    previous_stock   INTEGER NOT NULL DEFAULT 0,
    new_stock        INTEGER NOT NULL DEFAULT 0,
    reference_number VARCHAR(80),
    recipient        VARCHAR(160),
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes            TEXT,
    user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX ix_stock_transactions_medicine_id ON stock_transactions(medicine_id);
CREATE INDEX ix_stock_transactions_date ON stock_transactions(transaction_date);

CREATE TABLE demand_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id   INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    date          DATE    NOT NULL,
    quantity_used INTEGER NOT NULL DEFAULT 0,
    UNIQUE (medicine_id, date)
);

CREATE TABLE alerts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id  INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    alert_type   VARCHAR(30) NOT NULL,
    priority     INTEGER NOT NULL DEFAULT 3,
    message      TEXT NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at  DATETIME
);

CREATE INDEX ix_alerts_medicine_id ON alerts(medicine_id);
CREATE INDEX ix_alerts_status ON alerts(status);

CREATE TABLE notifications (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_type VARCHAR(30) NOT NULL,
    title             VARCHAR(200) NOT NULL,
    message           TEXT NOT NULL,
    medicine_id       INTEGER REFERENCES medicines(id) ON DELETE CASCADE,
    is_read           BOOLEAN NOT NULL DEFAULT 0,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE restock_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL,
    reason      VARCHAR(200),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type VARCHAR(40) NOT NULL,
    entity_id   INTEGER,
    action      VARCHAR(40) NOT NULL,
    details     TEXT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    key        VARCHAR(80) PRIMARY KEY,
    value      VARCHAR(255) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
