-- ============================================================================
-- TradeCore ADDITIVE Migration — Safe for existing databases
-- ============================================================================
-- This script ONLY adds new tables. It does NOT modify, drop, or truncate
-- any existing tables. Safe to run on a production database with data.
--
-- Usage: Import this via phpMyAdmin → Import tab → Choose file → Go
-- ============================================================================

-- 1. EXPENSES
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

-- 2. SUPPLIERS
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

-- 3. PURCHASE ORDERS
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

-- 4. CUSTOMERS
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

-- 5. COMPANY SETTINGS
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

-- 6. TAX RULES
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

-- 7. FLASH SALES
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

-- 8. STORIES
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

-- 9. DISPUTES
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

-- 10. DISPUTE MESSAGES
CREATE TABLE IF NOT EXISTS `dispute_messages` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `dispute_id`  VARCHAR(50)    NOT NULL,
  `sender`      VARCHAR(100)   NOT NULL,
  `sender_role` VARCHAR(50)    DEFAULT NULL,
  `message`     TEXT           NOT NULL,
  `created_at`  BIGINT         NOT NULL,
  INDEX `idx_dm_dispute` (`dispute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. PRODUCT RETURNS
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

-- 12. CHAT CONVERSATIONS
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

-- 13. CHAT MESSAGES
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

-- 14. ESCROW TRANSACTIONS
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

-- 15. VISUAL SEARCHES
CREATE TABLE IF NOT EXISTS `visual_searches` (
  `id`          VARCHAR(50)    PRIMARY KEY,
  `company_id`  VARCHAR(50)    NOT NULL,
  `user_id`     VARCHAR(50)    DEFAULT NULL,
  `image_url`   TEXT           NOT NULL,
  `results`     JSON           DEFAULT NULL,
  `created_at`  BIGINT         NOT NULL,
  INDEX `idx_vs_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. INSTALLMENT PLANS
CREATE TABLE IF NOT EXISTS `installment_plans` (
  `id`                       VARCHAR(50)    PRIMARY KEY,
  `product_id`               VARCHAR(50)    NOT NULL,
  `company_id`               VARCHAR(50)    NOT NULL,
  `total_price`              DECIMAL(15,2)  NOT NULL,
  `down_payment_percent`     TINYINT        NOT NULL,
  `installments_count`       TINYINT        NOT NULL,
  `installment_percent_extra` TINYINT       NOT NULL DEFAULT 0,
  `status`                   VARCHAR(20)    NOT NULL DEFAULT 'active',
  `created_at`               BIGINT         NOT NULL,
  INDEX `idx_ip_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. INSTALLMENT ORDERS
CREATE TABLE IF NOT EXISTS `installment_orders` (
  `id`                    VARCHAR(50)    PRIMARY KEY,
  `product_id`            VARCHAR(50)    NOT NULL,
  `company_id`            VARCHAR(50)    NOT NULL,
  `installment_plan_id`   VARCHAR(50)    NOT NULL,
  `customer_name`         VARCHAR(128)   NOT NULL,
  `customer_phone`        VARCHAR(24)    NOT NULL,
  `total_price`           DECIMAL(15,2)  NOT NULL,
  `down_payment`          DECIMAL(15,2)  NOT NULL,
  `remaining`             DECIMAL(15,2)  NOT NULL,
  `installment_amount`    DECIMAL(15,2)  NOT NULL,
  `installments_count`    TINYINT        NOT NULL,
  `paid_installments`     TINYINT        NOT NULL DEFAULT 0,
  `total_paid`            DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `status`                VARCHAR(20)    NOT NULL DEFAULT 'pending_down',
  `next_due_date`         BIGINT         DEFAULT NULL,
  `tracking_code`         VARCHAR(32)    NOT NULL,
  `order_id`              VARCHAR(50)    DEFAULT NULL,
  `created_at`            BIGINT         NOT NULL,
  UNIQUE INDEX `uniq_io_tracking` (`tracking_code`),
  INDEX `idx_io_company` (`company_id`),
  INDEX `idx_io_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. INSTALLMENT PAYMENTS
CREATE TABLE IF NOT EXISTS `installment_payments` (
  `id`                    VARCHAR(50)    PRIMARY KEY,
  `installment_order_id`  VARCHAR(50)    NOT NULL,
  `amount`                DECIMAL(15,2)  NOT NULL,
  `type`                  VARCHAR(20)    NOT NULL,
  `status`                VARCHAR(20)    NOT NULL DEFAULT 'pending',
  `reference`             VARCHAR(64)    DEFAULT NULL,
  `collection_id`         VARCHAR(50)    DEFAULT NULL,
  `due_date`              BIGINT         DEFAULT NULL,
  `paid_at`               BIGINT         DEFAULT NULL,
  `created_at`            BIGINT         NOT NULL,
  INDEX `idx_ipt_order` (`installment_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Done! All 18 new tables added safely without touching existing data.
SELECT 'Migration complete: 18 new tables added (existing data untouched)' AS result;
