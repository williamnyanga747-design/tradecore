-- TradeCore Migration 002 — Atomic Tables
-- Adds expenses, purchase_orders, suppliers, customers, company_settings,
-- tax_rules, flash_sales, stories, disputes, dispute_messages, product_returns,
-- chat_conversations, chat_messages, escrow_transactions, visual_searches,
-- and schema_migrations.

-- ============================================================================
-- 1. EXPENSES — Company expenses (rent, utilities, salaries, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `expenses` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `store_id`        VARCHAR(50)    DEFAULT NULL,
  `category`        VARCHAR(100)   NOT NULL,
  `description`     TEXT           DEFAULT NULL,
  `amount`          DECIMAL(15,2)  NOT NULL,
  `currency_code`   VARCHAR(8)     NOT NULL DEFAULT 'TZS',
  `amount_tzs`      DECIMAL(15,2)  NOT NULL,
  `date`            BIGINT         NOT NULL,
  `receipt_image`   LONGTEXT       DEFAULT NULL,
  `payment_method`  VARCHAR(50)    DEFAULT NULL,
  `reference`       VARCHAR(100)   DEFAULT NULL,
  `approved_by`     VARCHAR(100)   DEFAULT NULL,
  `status`          VARCHAR(20)    NOT NULL DEFAULT 'approved',
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_exp_company`    (`company_id`, `deleted_at`),
  INDEX `idx_exp_store`      (`store_id`, `deleted_at`),
  INDEX `idx_exp_category`   (`category`),
  INDEX `idx_exp_status`     (`status`),
  INDEX `idx_exp_date`       (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. SUPPLIERS — Supplier master data
-- ============================================================================

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `name`            VARCHAR(255)   NOT NULL,
  `phone`           VARCHAR(30)    DEFAULT NULL,
  `email`           VARCHAR(190)   DEFAULT NULL,
  `address`         TEXT           DEFAULT NULL,
  `city`            VARCHAR(100)   DEFAULT NULL,
  `contact_person`  VARCHAR(255)   DEFAULT NULL,
  `tax_id`          VARCHAR(50)    DEFAULT NULL,
  `notes`           TEXT           DEFAULT NULL,
  `is_active`       TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_sup_company`  (`company_id`, `deleted_at`),
  INDEX `idx_sup_active`   (`is_active`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. PURCHASE ORDERS — Purchase orders from suppliers
-- ============================================================================

CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `store_id`        VARCHAR(50)    DEFAULT NULL,
  `supplier_id`     VARCHAR(50)    DEFAULT NULL,
  `supplier_name`   VARCHAR(255)   DEFAULT NULL,
  `order_number`    VARCHAR(50)    NOT NULL,
  `status`          VARCHAR(30)    NOT NULL DEFAULT 'pending',
  `items`           JSON           NOT NULL,
  `subtotal`        DECIMAL(15,2)  NOT NULL,
  `tax_amount`      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `total`           DECIMAL(15,2)  NOT NULL,
  `currency_code`   VARCHAR(8)     NOT NULL DEFAULT 'TZS',
  `notes`           TEXT           DEFAULT NULL,
  `expected_date`   BIGINT         DEFAULT NULL,
  `received_date`   BIGINT         DEFAULT NULL,
  `received_by`     VARCHAR(100)   DEFAULT NULL,
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_po_company`   (`company_id`, `deleted_at`),
  INDEX `idx_po_store`     (`store_id`, `deleted_at`),
  INDEX `idx_po_supplier`  (`supplier_id`, `deleted_at`),
  INDEX `idx_po_status`    (`status`),
  INDEX `idx_po_order_num` (`order_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. CUSTOMERS — Customer master data (separate from users/marketplace)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `customers` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `name`            VARCHAR(255)   NOT NULL,
  `phone`           VARCHAR(30)    DEFAULT NULL,
  `email`           VARCHAR(190)   DEFAULT NULL,
  `address`         TEXT           DEFAULT NULL,
  `city`            VARCHAR(100)   DEFAULT NULL,
  `tax_id`          VARCHAR(50)    DEFAULT NULL,
  `loyalty_points`  INT            NOT NULL DEFAULT 0,
  `total_spent`     DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `notes`           TEXT           DEFAULT NULL,
  `is_active`       TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_cust_company` (`company_id`, `deleted_at`),
  INDEX `idx_cust_active`  (`is_active`, `deleted_at`),
  INDEX `idx_cust_phone`   (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. COMPANY SETTINGS — Per-company settings (replaces JSON blob)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `company_settings` (
  `id`                    VARCHAR(50)    PRIMARY KEY,
  `company_id`            VARCHAR(50)    NOT NULL,
  `currency_code`         VARCHAR(8)     NOT NULL DEFAULT 'TZS',
  `currency_symbol`       VARCHAR(8)     NOT NULL DEFAULT 'TSh',
  `exchange_rate`         DECIMAL(12,4)  NOT NULL DEFAULT 1,
  `tax_enabled`           TINYINT(1)     NOT NULL DEFAULT 0,
  `tax_rate`              DECIMAL(5,2)   NOT NULL DEFAULT 0,
  `receipt_header`        TEXT           DEFAULT NULL,
  `receipt_footer`        TEXT           DEFAULT NULL,
  `low_stock_threshold`   INT            NOT NULL DEFAULT 10,
  `pos_enabled`           TINYINT(1)     NOT NULL DEFAULT 1,
  `marketplace_enabled`   TINYINT(1)     NOT NULL DEFAULT 0,
  `loyalty_enabled`       TINYINT(1)     NOT NULL DEFAULT 0,
  `sms_notifications`     TINYINT(1)     NOT NULL DEFAULT 0,
  `extra_json`            JSON           DEFAULT NULL,
  `created_at`            BIGINT         NOT NULL,
  `updated_at`            BIGINT         NOT NULL,
  UNIQUE KEY `uniq_cs_company` (`company_id`),
  INDEX `idx_cs_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. TAX RULES — Tax rules/categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS `tax_rules` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `name`            VARCHAR(100)   NOT NULL,
  `rate`            DECIMAL(5,2)   NOT NULL,
  `type`            VARCHAR(20)    NOT NULL DEFAULT 'percentage',
  `applies_to`      VARCHAR(50)    NOT NULL DEFAULT 'all',
  `is_active`       TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_tax_company`  (`company_id`, `deleted_at`),
  INDEX `idx_tax_active`   (`is_active`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. FLASH SALES — Flash sale events
-- ============================================================================

CREATE TABLE IF NOT EXISTS `flash_sales` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `product_id`      VARCHAR(50)    NOT NULL,
  `original_price`  DECIMAL(15,2)  NOT NULL,
  `flash_price`     DECIMAL(15,2)  NOT NULL,
  `stock_limit`     INT            NOT NULL DEFAULT 0,
  `stock_sold`      INT            NOT NULL DEFAULT 0,
  `starts_at`       BIGINT         NOT NULL,
  `ends_at`         BIGINT         NOT NULL,
  `status`          VARCHAR(20)    NOT NULL DEFAULT 'scheduled',
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_fs_company`  (`company_id`, `deleted_at`),
  INDEX `idx_fs_product`  (`product_id`, `deleted_at`),
  INDEX `idx_fs_status`   (`status`),
  INDEX `idx_fs_dates`    (`starts_at`, `ends_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. STORIES — Instagram-like stories
-- ============================================================================

CREATE TABLE IF NOT EXISTS `stories` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `product_id`      VARCHAR(50)    DEFAULT NULL,
  `media_url`       TEXT           NOT NULL,
  `caption`         TEXT           DEFAULT NULL,
  `views_count`     INT            NOT NULL DEFAULT 0,
  `expires_at`      BIGINT         NOT NULL,
  `created_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_st_company`  (`company_id`, `deleted_at`),
  INDEX `idx_st_product`  (`product_id`, `deleted_at`),
  INDEX `idx_st_expires`  (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. DISPUTES — Order disputes
-- ============================================================================

CREATE TABLE IF NOT EXISTS `disputes` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `order_id`        VARCHAR(50)    NOT NULL,
  `raised_by`       VARCHAR(100)   NOT NULL,
  `reason`          VARCHAR(255)   NOT NULL,
  `description`     TEXT           DEFAULT NULL,
  `status`          VARCHAR(20)    NOT NULL DEFAULT 'open',
  `resolution`      TEXT           DEFAULT NULL,
  `resolved_by`     VARCHAR(100)   DEFAULT NULL,
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_disp_company`  (`company_id`, `deleted_at`),
  INDEX `idx_disp_order`    (`order_id`, `deleted_at`),
  INDEX `idx_disp_status`   (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. DISPUTE MESSAGES — Messages in a dispute thread
-- ============================================================================

CREATE TABLE IF NOT EXISTS `dispute_messages` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `dispute_id`      VARCHAR(50)    NOT NULL,
  `sender`          VARCHAR(100)   NOT NULL,
  `sender_role`     VARCHAR(50)    DEFAULT NULL,
  `message`         TEXT           NOT NULL,
  `created_at`      BIGINT         NOT NULL,
  INDEX `idx_dm_dispute`  (`dispute_id`),
  INDEX `idx_dm_sender`   (`sender`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. PRODUCT RETURNS — Product return requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS `product_returns` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `order_id`        VARCHAR(50)    NOT NULL,
  `product_id`      VARCHAR(50)    NOT NULL,
  `customer_name`   VARCHAR(255)   NOT NULL,
  `reason`          TEXT           NOT NULL,
  `status`          VARCHAR(20)    NOT NULL DEFAULT 'pending',
  `refund_amount`   DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `admin_note`      TEXT           DEFAULT NULL,
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  `deleted_at`      BIGINT         DEFAULT NULL,
  INDEX `idx_ret_company`  (`company_id`, `deleted_at`),
  INDEX `idx_ret_order`    (`order_id`, `deleted_at`),
  INDEX `idx_ret_product`  (`product_id`, `deleted_at`),
  INDEX `idx_ret_status`   (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. CHAT CONVERSATIONS — Buyer-seller chat threads
-- ============================================================================

CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `customer_name`   VARCHAR(255)   NOT NULL,
  `customer_phone`  VARCHAR(30)    DEFAULT NULL,
  `last_message`    TEXT           DEFAULT NULL,
  `last_message_at` BIGINT         DEFAULT NULL,
  `unread_count`    INT            NOT NULL DEFAULT 0,
  `status`          VARCHAR(20)    NOT NULL DEFAULT 'open',
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  INDEX `idx_cc_company`  (`company_id`),
  INDEX `idx_cc_status`   (`status`),
  INDEX `idx_cc_last_msg` (`last_message_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. CHAT MESSAGES — Individual chat messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `conversation_id` VARCHAR(50)    NOT NULL,
  `sender`          VARCHAR(100)   NOT NULL,
  `sender_role`     VARCHAR(50)    NOT NULL,
  `message`         TEXT           NOT NULL,
  `is_read`         TINYINT(1)     NOT NULL DEFAULT 0,
  `created_at`      BIGINT         NOT NULL,
  INDEX `idx_cmsg_conv`  (`conversation_id`),
  INDEX `idx_cmsg_read`  (`is_read`),
  INDEX `idx_cmsg_date`  (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. ESCROW TRANSACTIONS — Escrow for marketplace orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS `escrow_transactions` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `order_id`        VARCHAR(50)    NOT NULL,
  `buyer_id`        VARCHAR(50)    DEFAULT NULL,
  `seller_id`       VARCHAR(50)    DEFAULT NULL,
  `amount`          DECIMAL(15,2)  NOT NULL,
  `status`          VARCHAR(20)    NOT NULL DEFAULT 'held',
  `released_at`     BIGINT         DEFAULT NULL,
  `created_at`      BIGINT         NOT NULL,
  `updated_at`      BIGINT         NOT NULL,
  INDEX `idx_esc_company` (`company_id`),
  INDEX `idx_esc_order`   (`order_id`),
  INDEX `idx_esc_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 15. VISUAL SEARCHES — Visual search history
-- ============================================================================

CREATE TABLE IF NOT EXISTS `visual_searches` (
  `id`              VARCHAR(50)    PRIMARY KEY,
  `company_id`      VARCHAR(50)    NOT NULL,
  `user_id`         VARCHAR(50)    DEFAULT NULL,
  `image_url`       TEXT           NOT NULL,
  `results`         JSON           DEFAULT NULL,
  `created_at`      BIGINT         NOT NULL,
  INDEX `idx_vs_company` (`company_id`),
  INDEX `idx_vs_user`    (`user_id`),
  INDEX `idx_vs_date`    (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 16. SCHEMA MIGRATIONS — Tracks which migrations have been applied
-- ============================================================================

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id`          INT            PRIMARY KEY AUTO_INCREMENT,
  `version`     VARCHAR(50)    NOT NULL,
  `name`        VARCHAR(255)   NOT NULL,
  `applied_at`  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_sm_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record this migration
INSERT IGNORE INTO `schema_migrations` (`version`, `name`) VALUES
  ('002', 'atomic_tables');
