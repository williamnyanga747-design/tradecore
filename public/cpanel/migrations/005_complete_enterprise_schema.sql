-- ============================================================================
-- TradeCore Complete Enterprise MySQL Schema & Migration 005
-- Safe, additive migration: Creates missing tables and indexes if not present
-- Compatible with MySQL 5.7, 8.0, 8.4, and MariaDB (utf8mb4_unicode_ci)
-- ============================================================================

-- 1. AUDIT LOGS (for logCoreAction / get_audit_logs in api.php)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `timestamp`          DATETIME      NOT NULL,
  `operator_username`  VARCHAR(160)  NOT NULL,
  `role`               VARCHAR(100)  NOT NULL,
  `action_performed`   VARCHAR(160)  NOT NULL,
  `details`            VARCHAR(1000) DEFAULT NULL,
  `ip_address`         VARCHAR(45)   DEFAULT NULL,
  INDEX `idx_al_ts` (`timestamp`),
  INDEX `idx_al_action` (`action_performed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BRANCHES (Multi-Branch management)
CREATE TABLE IF NOT EXISTS `branches` (
  `id`              VARCHAR(64)  PRIMARY KEY,
  `company_id`      VARCHAR(64)  NOT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `code`            VARCHAR(64)  DEFAULT NULL,
  `phone`           VARCHAR(32)  DEFAULT NULL,
  `email`           VARCHAR(190) DEFAULT NULL,
  `address`         VARCHAR(255) DEFAULT NULL,
  `city`            VARCHAR(100) DEFAULT NULL,
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`      BIGINT       NOT NULL,
  `updated_at`      BIGINT       NOT NULL,
  `deleted_at`      BIGINT       DEFAULT NULL,
  INDEX `idx_branch_company` (`company_id`, `deleted_at`),
  INDEX `idx_branch_active`  (`is_active`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. PASSWORD RESET TOKENS (Secure 30-min tokens)
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id`              VARCHAR(64)  PRIMARY KEY,
  `token_hash`      CHAR(64)     NOT NULL,
  `user_id`         VARCHAR(64)  NOT NULL,
  `company_id`      VARCHAR(64)  DEFAULT NULL,
  `email`           VARCHAR(190) NOT NULL,
  `created_at`      BIGINT       NOT NULL,
  `expires_at`      BIGINT       NOT NULL,
  `consumed`        TINYINT(1)   NOT NULL DEFAULT 0,
  UNIQUE KEY `uniq_prt_hash` (`token_hash`),
  INDEX `idx_prt_hash_consumed` (`token_hash`, `consumed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SPONSORS / WADHAMINI (Corporate & Regional Sponsors)
CREATE TABLE IF NOT EXISTS `sponsors` (
  `id`              VARCHAR(64)  PRIMARY KEY,
  `sponsor_id`      VARCHAR(64)  UNIQUE,
  `company_id`      VARCHAR(64)  NULL COMMENT 'NULL=global homepage, co_xxx=specific company',
  `name`            VARCHAR(255) NOT NULL,
  `logo_url`        TEXT         NULL,
  `website_url`     VARCHAR(500) NULL,
  `description`     TEXT         NULL,
  `tier`            ENUM('platinum','gold','silver','bronze') DEFAULT 'gold',
  `is_active`       TINYINT(1)   DEFAULT 1,
  `sort_order`      INT          DEFAULT 0,
  `status`          VARCHAR(20)  DEFAULT 'ACTIVE',
  `start_date`      VARCHAR(32)  NULL,
  `end_date`        VARCHAR(32)  NULL,
  `is_archived`     TINYINT(1)   DEFAULT 0,
  `archived_at`     BIGINT       NULL,
  `created_at`      BIGINT       NOT NULL,
  `updated_at`      BIGINT       NOT NULL,
  `deleted_at`      BIGINT       NULL,
  INDEX `idx_sponsor_company` (`company_id`),
  INDEX `idx_sponsor_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. POS SHIFTS (Float Tracking, Drawer Cash Linking & Expense Reconciliation)
CREATE TABLE IF NOT EXISTS `pos_shifts` (
  `id`                   VARCHAR(64)   PRIMARY KEY,
  `company_id`           VARCHAR(64)   NOT NULL,
  `store_id`             VARCHAR(64)   NOT NULL,
  `user_id`              VARCHAR(64)   NOT NULL,
  `username`             VARCHAR(100)  NOT NULL,
  `open_time`            VARCHAR(50)   NOT NULL,
  `close_time`           VARCHAR(50)   DEFAULT NULL,
  `opening_float`        DECIMAL(15,2) NOT NULL DEFAULT 0,
  `closing_cash_actual`  DECIMAL(15,2) DEFAULT NULL,
  `expected_cash_sales`  DECIMAL(15,2) DEFAULT NULL,
  `sales_order_ids`      JSON          DEFAULT NULL,
  `drawer_expenses_total` DECIMAL(15,2) DEFAULT 0,
  `expense_ids`          JSON          DEFAULT NULL,
  `status`               VARCHAR(20)   NOT NULL DEFAULT 'Open',
  `variance`             DECIMAL(15,2) DEFAULT NULL,
  `notes`                TEXT          DEFAULT NULL,
  `created_at`           BIGINT        NOT NULL,
  `updated_at`           BIGINT        NOT NULL,
  `deleted_at`           BIGINT        DEFAULT NULL,
  INDEX `idx_shift_company` (`company_id`, `store_id`),
  INDEX `idx_shift_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. STOCK TRANSFERS (2-Step Inspection Handshake & Discrepancy Adjustments)
CREATE TABLE IF NOT EXISTS `stock_transfers` (
  `id`                 VARCHAR(64)   PRIMARY KEY,
  `company_id`         VARCHAR(64)   NOT NULL,
  `transfer_number`    VARCHAR(64)   NOT NULL,
  `product_id`         VARCHAR(64)   NOT NULL,
  `from_store_id`      VARCHAR(64)   NOT NULL,
  `to_store_id`        VARCHAR(64)   NOT NULL,
  `qty`                DECIMAL(15,3) NOT NULL,
  `status`             VARCHAR(50)   NOT NULL DEFAULT 'Pending',
  `dispatched_by`      VARCHAR(100)  DEFAULT NULL,
  `received_by`        VARCHAR(100)  DEFAULT NULL,
  `received_qty`       DECIMAL(15,3) DEFAULT NULL,
  `damaged_qty`        DECIMAL(15,3) DEFAULT NULL,
  `missing_qty`        DECIMAL(15,3) DEFAULT NULL,
  `discrepancy_reason` TEXT          DEFAULT NULL,
  `loss_recorded`      TINYINT(1)    DEFAULT 0,
  `sent_at`            VARCHAR(50)   DEFAULT NULL,
  `received_at`        VARCHAR(50)   DEFAULT NULL,
  `created_at`         BIGINT        NOT NULL,
  `updated_at`         BIGINT        NOT NULL,
  `deleted_at`         BIGINT        DEFAULT NULL,
  INDEX `idx_st_company` (`company_id`),
  INDEX `idx_st_stores` (`from_store_id`, `to_store_id`),
  INDEX `idx_st_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. CONTACT MESSAGES (Public Website Inquiries)
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id`                 VARCHAR(64)   PRIMARY KEY,
  `name`               VARCHAR(255)  NOT NULL,
  `email`              VARCHAR(190)  NOT NULL,
  `phone`              VARCHAR(32)   NOT NULL,
  `subject`            VARCHAR(255)  NOT NULL,
  `message`            TEXT          NOT NULL,
  `status`             VARCHAR(20)   NOT NULL DEFAULT 'new',
  `created_at`         BIGINT        NOT NULL,
  `updated_at`         BIGINT        NOT NULL,
  `deleted_at`         BIGINT        DEFAULT NULL,
  INDEX `idx_cm_email` (`email`),
  INDEX `idx_cm_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TALLY ACCOUNTING SYSTEM: Chart of Accounts
CREATE TABLE IF NOT EXISTS `accounting_accounts` (
  `id`                 VARCHAR(64)   PRIMARY KEY,
  `company_id`         VARCHAR(64)   NOT NULL,
  `code`               VARCHAR(64)   NOT NULL,
  `name`               VARCHAR(255)  NOT NULL,
  `type`               ENUM('Asset','Liability','Equity','Income','Expense') NOT NULL,
  `category`           VARCHAR(64)   NOT NULL,
  `opening_balance`    DECIMAL(18,2) NOT NULL DEFAULT 0,
  `current_balance`    DECIMAL(18,2) NOT NULL DEFAULT 0,
  `description`        TEXT          DEFAULT NULL,
  `created_at`         BIGINT        NOT NULL,
  `updated_at`         BIGINT        NOT NULL,
  `deleted_at`         BIGINT        DEFAULT NULL,
  INDEX `idx_acc_company_code` (`company_id`, `code`),
  INDEX `idx_acc_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TALLY ACCOUNTING SYSTEM: Double-Entry Journal Vouchers
CREATE TABLE IF NOT EXISTS `journal_vouchers` (
  `id`                 VARCHAR(64)   PRIMARY KEY,
  `company_id`         VARCHAR(64)   NOT NULL,
  `voucher_no`         VARCHAR(64)   NOT NULL,
  `date`               VARCHAR(32)   NOT NULL,
  `type`               VARCHAR(30)   NOT NULL DEFAULT 'Journal',
  `narration`          TEXT          DEFAULT NULL,
  `entries`            JSON          NOT NULL,
  `total_debit`        DECIMAL(18,2) NOT NULL DEFAULT 0,
  `total_credit`       DECIMAL(18,2) NOT NULL DEFAULT 0,
  `created_by`         VARCHAR(100)  DEFAULT NULL,
  `created_at`         BIGINT        NOT NULL,
  `updated_at`         BIGINT        NOT NULL,
  `deleted_at`         BIGINT        DEFAULT NULL,
  INDEX `idx_jv_company_voucher` (`company_id`, `voucher_no`),
  INDEX `idx_jv_date` (`company_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. EXPENSES (Atomic table)
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

-- 11. SUPPLIERS
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

-- 12. PURCHASE ORDERS
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
  INDEX `idx_po_status`    (`status`),
  INDEX `idx_po_supplier`  (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. CUSTOMERS
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
  INDEX `idx_cust_phone`   (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. COMPANY SETTINGS
CREATE TABLE IF NOT EXISTS `company_settings` (
  `id`                   VARCHAR(50)    PRIMARY KEY,
  `company_id`           VARCHAR(50)    NOT NULL UNIQUE,
  `currency_code`        VARCHAR(8)     NOT NULL DEFAULT 'TZS',
  `currency_symbol`      VARCHAR(8)     NOT NULL DEFAULT 'TSh',
  `exchange_rate`        DECIMAL(12,4)  NOT NULL DEFAULT 1,
  `tax_enabled`          TINYINT(1)     NOT NULL DEFAULT 0,
  `tax_rate`             DECIMAL(5,2)   NOT NULL DEFAULT 0,
  `receipt_header`       TEXT           DEFAULT NULL,
  `receipt_footer`       TEXT           DEFAULT NULL,
  `low_stock_threshold`  INT            NOT NULL DEFAULT 10,
  `pos_enabled`          TINYINT(1)     NOT NULL DEFAULT 1,
  `marketplace_enabled`  TINYINT(1)     NOT NULL DEFAULT 0,
  `loyalty_enabled`      TINYINT(1)     NOT NULL DEFAULT 0,
  `sms_notifications`    TINYINT(1)     NOT NULL DEFAULT 0,
  `extra_json`           JSON           DEFAULT NULL,
  `created_at`           BIGINT         NOT NULL,
  `updated_at`           BIGINT         NOT NULL,
  INDEX `idx_cs_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. TAX RULES
CREATE TABLE IF NOT EXISTS `tax_rules` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `company_id`  VARCHAR(50)    NOT NULL,
  `name`        VARCHAR(100)   NOT NULL,
  `rate`        DECIMAL(5,2)   NOT NULL,
  `type`        VARCHAR(20)    NOT NULL DEFAULT 'percentage',
  `applies_to`  VARCHAR(50)    NOT NULL DEFAULT 'all',
  `is_active`   TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`  BIGINT         NOT NULL,
  `updated_at`  BIGINT         NOT NULL,
  `deleted_at`  BIGINT         DEFAULT NULL,
  INDEX `idx_tax_company` (`company_id`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. FLASH SALES
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
  INDEX `idx_fs_status`   (`status`),
  INDEX `idx_fs_product`  (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. STORIES (Ephemeral media)
CREATE TABLE IF NOT EXISTS `stories` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `company_id`  VARCHAR(50)    NOT NULL,
  `product_id`  VARCHAR(50)    DEFAULT NULL,
  `media_url`   TEXT           NOT NULL,
  `caption`     TEXT           DEFAULT NULL,
  `views_count` INT            NOT NULL DEFAULT 0,
  `expires_at`  BIGINT         NOT NULL,
  `created_at`  BIGINT         NOT NULL,
  `deleted_at`  BIGINT         DEFAULT NULL,
  INDEX `idx_st_company`  (`company_id`, `deleted_at`),
  INDEX `idx_st_expires`  (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. DISPUTES
CREATE TABLE IF NOT EXISTS `disputes` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `company_id`  VARCHAR(50)    NOT NULL,
  `order_id`    VARCHAR(50)    NOT NULL,
  `raised_by`   VARCHAR(100)   NOT NULL,
  `reason`      VARCHAR(255)   NOT NULL,
  `description` TEXT           DEFAULT NULL,
  `status`      VARCHAR(20)    NOT NULL DEFAULT 'open',
  `resolution`  TEXT           DEFAULT NULL,
  `resolved_by` VARCHAR(100)   DEFAULT NULL,
  `created_at`  BIGINT         NOT NULL,
  `updated_at`  BIGINT         NOT NULL,
  `deleted_at`  BIGINT         DEFAULT NULL,
  INDEX `idx_dis_company` (`company_id`, `deleted_at`),
  INDEX `idx_dis_order`   (`order_id`),
  INDEX `idx_dis_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. DISPUTE MESSAGES
CREATE TABLE IF NOT EXISTS `dispute_messages` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `dispute_id`  VARCHAR(50)    NOT NULL,
  `sender`      VARCHAR(100)   NOT NULL,
  `sender_role` VARCHAR(50)    DEFAULT NULL,
  `message`     TEXT           NOT NULL,
  `created_at`  BIGINT         NOT NULL,
  INDEX `idx_dm_dispute` (`dispute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. PRODUCT RETURNS
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
  INDEX `idx_pr_company` (`company_id`, `deleted_at`),
  INDEX `idx_pr_order`   (`order_id`),
  INDEX `idx_pr_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. CHAT CONVERSATIONS
CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `id`                VARCHAR(50)    PRIMARY KEY,
  `company_id`        VARCHAR(50)    NOT NULL,
  `customer_name`     VARCHAR(255)   NOT NULL,
  `customer_phone`    VARCHAR(30)    DEFAULT NULL,
  `last_message`      TEXT           DEFAULT NULL,
  `last_message_at`   BIGINT         DEFAULT NULL,
  `unread_count`      INT            NOT NULL DEFAULT 0,
  `status`            VARCHAR(20)    NOT NULL DEFAULT 'open',
  `created_at`        BIGINT         NOT NULL,
  `updated_at`        BIGINT         NOT NULL,
  INDEX `idx_cc_company` (`company_id`),
  INDEX `idx_cc_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id`                VARCHAR(50)    PRIMARY KEY,
  `conversation_id`   VARCHAR(50)    NOT NULL,
  `sender`            VARCHAR(100)   NOT NULL,
  `sender_role`       VARCHAR(50)    NOT NULL,
  `message`           TEXT           NOT NULL,
  `is_read`           TINYINT(1)     NOT NULL DEFAULT 0,
  `created_at`        BIGINT         NOT NULL,
  INDEX `idx_cm_conv` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. ESCROW TRANSACTIONS
CREATE TABLE IF NOT EXISTS `escrow_transactions` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `company_id`  VARCHAR(50)    NOT NULL,
  `order_id`    VARCHAR(50)    NOT NULL,
  `buyer_id`    VARCHAR(50)    DEFAULT NULL,
  `seller_id`   VARCHAR(50)    DEFAULT NULL,
  `amount`      DECIMAL(15,2)  NOT NULL,
  `status`      VARCHAR(20)    NOT NULL DEFAULT 'held',
  `released_at` BIGINT         DEFAULT NULL,
  `created_at`  BIGINT         NOT NULL,
  `updated_at`  BIGINT         NOT NULL,
  INDEX `idx_esc_company` (`company_id`),
  INDEX `idx_esc_order`   (`order_id`),
  INDEX `idx_esc_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. VISUAL SEARCHES
CREATE TABLE IF NOT EXISTS `visual_searches` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `company_id`  VARCHAR(50)    NOT NULL,
  `user_id`     VARCHAR(50)    DEFAULT NULL,
  `image_url`   TEXT           NOT NULL,
  `results`     JSON           DEFAULT NULL,
  `created_at`  BIGINT         NOT NULL,
  INDEX `idx_vs_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Done! All enterprise tables verified and ready.
SELECT 'Migration 005 complete: Complete Enterprise Database Schema applied successfully' AS result;
