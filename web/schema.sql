-- MODUS ERP Database Schema (PostgreSQL)
-- Open-source Enterprise Resource Planning & Invoicing System

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  name VARCHAR(255),
  full_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  designation VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user',
  password_hash TEXT NOT NULL,
  must_reset_password BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  avatar_object_key TEXT,
  last_login_at TIMESTAMPTZ,
  country TEXT,
  department TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);

-- 2. Audit & Observability
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  metadata_json JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  changes JSONB,
  changed_by INTEGER,
  changed_by_name VARCHAR(255),
  ip VARCHAR(64),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(255),
  related_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 3. Company Settings & Invoice Templates
CREATE TABLE IF NOT EXISTS company_settings (
  id SERIAL PRIMARY KEY,
  legal_name VARCHAR(255),
  trade_name VARCHAR(255),
  registered_name VARCHAR(255),
  gstin VARCHAR(20),
  pan VARCHAR(20),
  cin VARCHAR(30),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(4),
  pincode VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  logo_url TEXT,
  logo_dark_url TEXT,
  signature_url TEXT,
  bank_name VARCHAR(100),
  bank_account_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  bank_swift VARCHAR(20),
  bank_branch VARCHAR(100),
  upi_id VARCHAR(100),
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  next_invoice_number INTEGER DEFAULT 1,
  invoice_format VARCHAR(20) DEFAULT 'fy',
  quote_prefix VARCHAR(20) DEFAULT 'QT',
  next_quote_number INTEGER DEFAULT 1,
  proforma_prefix VARCHAR(20) DEFAULT 'PI',
  next_proforma_number INTEGER DEFAULT 1,
  self_invoice_prefix VARCHAR(20) DEFAULT 'SI',
  next_self_invoice_number INTEGER DEFAULT 1,
  credit_note_prefix VARCHAR(20) DEFAULT 'CN',
  next_credit_note_number INTEGER DEFAULT 1,
  default_terms TEXT,
  default_declaration TEXT,
  default_notes TEXT,
  notification_prefs JSONB DEFAULT '{}',
  lut_number VARCHAR(50),
  turnover_above_5cr BOOLEAN DEFAULT false,
  einvoice_applicable_from DATE,
  books_locked_until DATE,
  openrouter_api_key VARCHAR(255),
  openrouter_model VARCHAR(100) DEFAULT 'google/gemini-2.5-flash',
  nvidia_api_key VARCHAR(255),
  nvidia_model VARCHAR(100) DEFAULT 'meta/llama-3.1-405b-instruct',
  unstructured_api_key VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  config_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Customers & CRM
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  gstin VARCHAR(20),
  pan VARCHAR(20),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  customer_type VARCHAR(50) DEFAULT 'business',
  credit_limit NUMERIC(12,2),
  billing_address TEXT,
  shipping_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(4),
  pincode VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  contact_person VARCHAR(255),
  notes TEXT,
  gst_treatment VARCHAR(40) DEFAULT 'unregistered',
  image_url TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Projects
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  client_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  budget NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Services Catalog
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_price NUMERIC NOT NULL DEFAULT 0,
  gst_rate NUMERIC NOT NULL DEFAULT 18,
  hsn_sac_code TEXT DEFAULT '9983',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Invoices & AR
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(40) UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  invoice_date DATE NOT NULL,
  due_date DATE,
  po_number VARCHAR(100),
  reverse_charge BOOLEAN DEFAULT false,
  payment_terms VARCHAR(255),
  place_of_supply VARCHAR(255),
  place_of_supply_code VARCHAR(4),
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC(12,6) DEFAULT 1.0,
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_discount NUMERIC(14,2) DEFAULT 0,
  taxable_amount NUMERIC(14,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  round_off NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  amount_in_words TEXT,
  tax_inclusive BOOLEAN DEFAULT false,
  is_interstate BOOLEAN DEFAULT false,
  notes TEXT,
  terms TEXT,
  payment_instructions TEXT,
  declaration TEXT,
  template_id INTEGER,
  status VARCHAR(30) DEFAULT 'draft',
  is_archived BOOLEAN DEFAULT false,
  created_by INTEGER,
  snapshot_seller_json JSONB DEFAULT '{}',
  snapshot_buyer_json JSONB DEFAULT '{}',
  payment_method VARCHAR(50),
  service_period_from DATE,
  service_period_to DATE,
  gst_category VARCHAR(40),
  gst_treatment VARCHAR(40),
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  tds_section VARCHAR(10),
  tds_rate NUMERIC(5,2) DEFAULT 0,
  tds_amount NUMERIC(14,2) DEFAULT 0,
  overdue_notified_at TIMESTAMPTZ,
  pdf_url TEXT,
  pdf_object_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  item_name VARCHAR(500) NOT NULL,
  description TEXT,
  hsn_sac_code VARCHAR(20),
  quantity NUMERIC(12,3) DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'Nos',
  unit_price NUMERIC(14,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  taxable_value NUMERIC(14,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  cgst_rate NUMERIC(5,2) DEFAULT 0,
  sgst_rate NUMERIC(5,2) DEFAULT 0,
  igst_rate NUMERIC(5,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoice_versions (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  changed_by INTEGER,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(255),
  reference_number VARCHAR(255),
  notes TEXT,
  receipt_url TEXT,
  receipt_object_key TEXT,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC(12,6) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Quotations & Proforma Invoices
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  quote_number VARCHAR NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  project_id INTEGER,
  quote_date DATE NOT NULL,
  valid_until DATE,
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_discount NUMERIC(14,2) DEFAULT 0,
  taxable_amount NUMERIC(14,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  round_off NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  amount_in_words TEXT,
  tax_inclusive BOOLEAN DEFAULT false,
  is_interstate BOOLEAN DEFAULT false,
  gst_category VARCHAR DEFAULT 'B2B',
  place_of_supply VARCHAR,
  place_of_supply_code VARCHAR,
  reverse_charge BOOLEAN DEFAULT false,
  status VARCHAR DEFAULT 'draft',
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC(12,6) DEFAULT 1.0,
  notes TEXT,
  terms TEXT,
  declaration TEXT,
  payment_method TEXT,
  service_period_from DATE,
  service_period_to DATE,
  snapshot_seller_json JSONB,
  snapshot_buyer_json JSONB,
  template_id INTEGER,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER,
  item_name VARCHAR,
  description TEXT,
  hsn_sac_code VARCHAR,
  quantity NUMERIC(14,2),
  unit VARCHAR,
  unit_price NUMERIC(14,2),
  discount_percent NUMERIC(6,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  taxable_value NUMERIC(14,2) DEFAULT 0,
  gst_rate NUMERIC(6,2) DEFAULT 0,
  cgst_rate NUMERIC(6,2) DEFAULT 0,
  sgst_rate NUMERIC(6,2) DEFAULT 0,
  igst_rate NUMERIC(6,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS proforma (
  id SERIAL PRIMARY KEY,
  proforma_number VARCHAR NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  project_id INTEGER,
  proforma_date DATE NOT NULL,
  valid_until DATE,
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_discount NUMERIC(14,2) DEFAULT 0,
  taxable_amount NUMERIC(14,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  round_off NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  amount_in_words TEXT,
  tax_inclusive BOOLEAN DEFAULT false,
  is_interstate BOOLEAN DEFAULT false,
  gst_category VARCHAR DEFAULT 'B2B',
  place_of_supply VARCHAR,
  place_of_supply_code VARCHAR,
  reverse_charge BOOLEAN DEFAULT false,
  status VARCHAR DEFAULT 'draft',
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC(12,6) DEFAULT 1.0,
  notes TEXT,
  terms TEXT,
  declaration TEXT,
  payment_method TEXT,
  service_period_from DATE,
  service_period_to DATE,
  snapshot_seller_json JSONB,
  snapshot_buyer_json JSONB,
  template_id INTEGER,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proforma_items (
  id SERIAL PRIMARY KEY,
  proforma_id INTEGER REFERENCES proforma(id) ON DELETE CASCADE,
  position INTEGER,
  item_name VARCHAR,
  description TEXT,
  hsn_sac_code VARCHAR,
  quantity NUMERIC(14,2),
  unit VARCHAR,
  unit_price NUMERIC(14,2),
  discount_percent NUMERIC(6,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  taxable_value NUMERIC(14,2) DEFAULT 0,
  gst_rate NUMERIC(6,2) DEFAULT 0,
  cgst_rate NUMERIC(6,2) DEFAULT 0,
  sgst_rate NUMERIC(6,2) DEFAULT 0,
  igst_rate NUMERIC(6,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) DEFAULT 0
);

-- 9. Vendors & Employees (AP & Payroll)
CREATE TABLE IF NOT EXISTS vendors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  category VARCHAR(50) DEFAULT 'supplier',
  gstin VARCHAR(20),
  pan VARCHAR(15),
  email VARCHAR(255),
  phone VARCHAR(30),
  billing_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(10),
  pincode VARCHAR(10),
  country VARCHAR(100) DEFAULT 'India',
  contact_person VARCHAR(255),
  website VARCHAR(255),
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  bank_ifsc VARCHAR(20),
  notes TEXT,
  gst_treatment VARCHAR(40),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(100),
  department VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(30),
  employee_id VARCHAR(50),
  pan VARCHAR(15),
  join_date DATE,
  salary_amount DECIMAL(12,2),
  salary_frequency VARCHAR(20) DEFAULT 'monthly',
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  bank_ifsc VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. Bills & AP Expenses
CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  bill_number VARCHAR(40) UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'expense',
  vendor_id INTEGER,
  employee_id INTEGER,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'approved',
  reference_number VARCHAR(255),
  notes TEXT,
  tax NUMERIC(12,2) DEFAULT 0,
  due_soon_notified_at TIMESTAMPTZ,
  receipt_url TEXT,
  receipt_object_key TEXT,
  project VARCHAR(255),
  project_id INTEGER,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC(12,6) DEFAULT 1.0,
  is_rcm BOOLEAN DEFAULT false,
  rcm_section VARCHAR(40),
  rcm_rate NUMERIC(5,2) DEFAULT 0,
  rcm_tax_amount NUMERIC(14,2) DEFAULT 0,
  itc_eligibility VARCHAR(30),
  self_invoice_number VARCHAR(40),
  gst_treatment VARCHAR(40),
  tds_section VARCHAR(10),
  tds_rate NUMERIC(5,2) DEFAULT 0,
  tds_amount NUMERIC(14,2) DEFAULT 0,
  tds_deposited BOOLEAN DEFAULT false,
  approved_by INTEGER,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  payee VARCHAR(255),
  foreign_amount NUMERIC(14,2),
  foreign_currency VARCHAR(10),
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  reference_number VARCHAR(255),
  notes TEXT,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC(12,6) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Credit Notes & Refunds
CREATE TABLE IF NOT EXISTS credit_notes (
  id SERIAL PRIMARY KEY,
  credit_note_number VARCHAR(40) UNIQUE,
  credit_note_date DATE NOT NULL,
  invoice_id INTEGER REFERENCES invoices(id),
  customer_id INTEGER REFERENCES customers(id),
  reason_code VARCHAR(4),
  reason_text TEXT,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC(12,6) DEFAULT 1.0,
  place_of_supply VARCHAR(255),
  place_of_supply_code VARCHAR(4),
  is_interstate BOOLEAN DEFAULT false,
  gst_category VARCHAR(40),
  taxable_amount NUMERIC(14,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  total_amount NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'issued',
  snapshot_seller_json JSONB,
  snapshot_buyer_json JSONB,
  pdf_url TEXT,
  pdf_object_key TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id SERIAL PRIMARY KEY,
  credit_note_id INTEGER REFERENCES credit_notes(id) ON DELETE CASCADE,
  invoice_item_id INTEGER,
  position INTEGER DEFAULT 0,
  item_name VARCHAR(500),
  description TEXT,
  hsn_sac_code VARCHAR(20),
  unit VARCHAR(20),
  quantity NUMERIC(12,3) DEFAULT 1,
  rate NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  taxable_value NUMERIC(14,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  total_tax NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS refund_disbursements (
  id SERIAL PRIMARY KEY,
  credit_note_id INTEGER REFERENCES credit_notes(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id),
  amount NUMERIC(14,2) NOT NULL,
  refund_date DATE NOT NULL,
  method VARCHAR(40) DEFAULT 'bank_transfer',
  reference_number VARCHAR(255),
  notes TEXT,
  receipt_url TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Documents & Storage
CREATE TABLE IF NOT EXISTS document_folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS document_folders_customer_unique
  ON document_folders (customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_url TEXT NOT NULL,
  object_key TEXT NOT NULL,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
