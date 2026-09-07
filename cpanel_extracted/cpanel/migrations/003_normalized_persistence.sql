-- ============================================================================
-- Migration 003 — Normalized Persistent Backend Storage (PBS)
-- Project : TradeCore ERP (Tanzania Trade Core)
-- Purpose : Establish the authoritative normalized MySQL schema that replaces the
--           monolithic tradecore_system_state JSON blob as the durability layer.
--           Explicit relational tables for the core aggregates:
--             companies, stores, products, stock_categories, user_accounts,
--             audit_trails.
--
-- ARCHITECTURE NOTE
-- -----------------
-- * The legacy `tradecore_*` atomic tables (one row per entity with a JSON `data`
--   column) and the 5 MB blob remain as a READ/WRITE compatibility bridge during
--   the transition. The normalized tables below are the single source of truth.
-- * api.php self-heals at runtime: tcEnsureNormalizedTables() creates any missing
--   table and tcMirrorNormalized() backfills normalized rows from every save_state
--   and company snapshot, so fresh installs work even before this migration runs.
-- * Foreign keys are deliberately supplied at the END of this file, to be enabled
--   after the runtime backfill has populated parent rows (migrations are applied
--   before a single sync on new installs; existing installs have blob data that
--   only becomes parent rows once api.php runs). Applying the FK block on a
--   fresh DB right after import is safe.
-- * All ids are VARCHAR(64) to match the app's string/numeric mixed ids and
--   company_ids; soft deletes use deleted_at tombstones exactly like the existing
--   tradecore_* tables. `status` mirrors the user account lifecycle.
--
-- Safe to run multiple times (IF NOT EXISTS / INSERT IGNORE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. COMPANIES — the tenant root. Owned by a super-admin user_account.id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `companies` (
  `id`              VARCHAR(64)  PRIMARY KEY,
  `owner_user_id`   VARCHAR(64)  DEFAULT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `code`            VARCHAR(64)  DEFAULT NULL,
  `currency_code`   VARCHAR(8)   NOT NULL DEFAULT 'TZS',
  `country`         VARCHAR(64)  NOT NULL DEFAULT 'Tanzania',
  `phone`           VARCHAR(32)  DEFAULT NULL,
  `email`           VARCHAR(190) DEFAULT NULL,
  `tin_number`      VARCHAR(32)  DEFAULT NULL,
  `address`         VARCHAR(255) DEFAULT NULL,
  `latitude`        DECIMAL(10,7) DEFAULT NULL,
  `longitude`       DECIMAL(10,7) DEFAULT NULL,
  `is_verified`     TINYINT(1)   NOT NULL DEFAULT 0,
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'active',
  `locale`          VARCHAR(5)   NOT NULL DEFAULT 'en',
  `settings_json`   TEXT         DEFAULT NULL,
  `created_at`      BIGINT       NOT NULL,
  `updated_at`      BIGINT       NOT NULL,
  `deleted_at`      BIGINT       DEFAULT NULL,
  INDEX `idx_comp_active` (`is_active`, `deleted_at`),
  INDEX `idx_comp_code`   (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. STORES — operating units (POS registers / locations) scoped to a company.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stores` (
  `id`              VARCHAR(64)  PRIMARY KEY,
  `company_id`      VARCHAR(64)  NOT NULL,
  `branch_id`       VARCHAR(64)  DEFAULT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `code`            VARCHAR(64)  DEFAULT NULL,
  `phone`           VARCHAR(32)  DEFAULT NULL,
  `email`           VARCHAR(190) DEFAULT NULL,
  `address`         VARCHAR(255) DEFAULT NULL,
  `city`            VARCHAR(100) DEFAULT NULL,
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `settings_json`   TEXT         DEFAULT NULL,
  `created_at`      BIGINT       NOT NULL,
  `updated_at`      BIGINT       NOT NULL,
  `deleted_at`      BIGINT       DEFAULT NULL,
  INDEX `idx_store_company`   (`company_id`, `deleted_at`),
  INDEX `idx_store_active`    (`is_active`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. STOCK CATEGORIES — per-company category rows, supersedes tradecore_categories
--    as the normalized target (tradecore_categories is the legacy atomic mirror).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_categories` (
  `id`              VARCHAR(64)  PRIMARY KEY,
  `company_id`      VARCHAR(64)  NOT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `parent_id`       VARCHAR(64)  DEFAULT NULL,
  `color`           VARCHAR(16)  DEFAULT NULL,
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`      BIGINT       NOT NULL,
  `updated_at`      BIGINT       NOT NULL,
  `deleted_at`      BIGINT       DEFAULT NULL,
  UNIQUE KEY `uniq_sc_cat_company` (`company_id`, `name`),
  INDEX `idx_sc_company` (`company_id`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. PRODUCTS — normalized inventory/listing rows. Supersedes tradecore_products
--    (the legacy atomic mirror). store_id/category_id are logical FKs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id`                  VARCHAR(64)  PRIMARY KEY,
  `company_id`          VARCHAR(64)  NOT NULL,
  `store_id`            VARCHAR(64)  DEFAULT NULL,
  `category_id`         VARCHAR(64)  DEFAULT NULL,
  `sku`                 VARCHAR(128) DEFAULT NULL,
  `name`                VARCHAR(255) NOT NULL,
  `barcode`             VARCHAR(128) DEFAULT NULL,
  `unit_price`          DECIMAL(18,2) NOT NULL DEFAULT 0,
  `cost_price`          DECIMAL(18,2) NOT NULL DEFAULT 0,
  `stock_qty`           DECIMAL(18,3) NOT NULL DEFAULT 0,
  `low_stock_threshold` DECIMAL(18,3) DEFAULT NULL,
  `tax_rate`            DECIMAL(5,2)  NOT NULL DEFAULT 0,
  `unit`                VARCHAR(32)  DEFAULT NULL,
  `image_url`           VARCHAR(500) DEFAULT NULL,
  `description`         TEXT         DEFAULT NULL,
  `tags_json`           TEXT         DEFAULT NULL,
  `extra_json`          TEXT         DEFAULT NULL,
  `is_active`           TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`          BIGINT       NOT NULL,
  `updated_at`          BIGINT       NOT NULL,
  `deleted_at`          BIGINT       DEFAULT NULL,
  INDEX `idx_prod_company` (`company_id`, `deleted_at`),
  INDEX `idx_prod_store`   (`store_id`, `deleted_at`),
  INDEX `idx_prod_cat`     (`category_id`, `deleted_at`),
  INDEX `idx_prod_updated` (`company_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. USER_ACCOUNTS — staff/operator accounts (normalized). Supersedes
--    tradecore_users as the normalized target. Roles match the app:
--    'Super Admin','Manager','Cashier','Accountant','Stock Manager', etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_accounts` (
  `id`               VARCHAR(64)  PRIMARY KEY,
  `company_id`       VARCHAR(64)  DEFAULT NULL,
  `full_name`        VARCHAR(255) DEFAULT NULL,
  `username`         VARCHAR(100) DEFAULT NULL,
  `phone`            VARCHAR(24)  NOT NULL,
  `email`            VARCHAR(190) DEFAULT NULL,
  `role`             VARCHAR(50)  NOT NULL DEFAULT 'Cashier',
  `password_hash`    VARCHAR(255) DEFAULT NULL,
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `status`           VARCHAR(20)  NOT NULL DEFAULT 'active',
  `locale`           VARCHAR(5)   NOT NULL DEFAULT 'en',
  `permissions_json` TEXT         DEFAULT NULL,
  `created_at`       BIGINT       NOT NULL,
  `updated_at`       BIGINT       NOT NULL,
  `deleted_at`       BIGINT       DEFAULT NULL,
  UNIQUE KEY `uniq_ua_phone_company` (`phone`, `company_id`),
  UNIQUE KEY `uniq_ua_username`  (`username`),
  INDEX `idx_ua_company` (`company_id`, `deleted_at`),
  INDEX `idx_ua_active`  (`is_active`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. AUDIT_TRAILS — normalized append-only audit log. `details_json` supersedes
--    the legacy `details` TEXT convenience column (both are written by api.php).
--    idempotent with the existing database.sql `audit_trails` table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_trails` (
  `id`            VARCHAR(64)  PRIMARY KEY,
  `company_id`    VARCHAR(64)  NOT NULL,
  `store_id`      VARCHAR(64)  DEFAULT NULL,
  `user_id`       VARCHAR(64)  DEFAULT NULL,
  `user_name`     VARCHAR(255) DEFAULT NULL,
  `action`        VARCHAR(100) NOT NULL,
  `entity_type`   VARCHAR(100) DEFAULT NULL,
  `entity_id`     VARCHAR(64)  DEFAULT NULL,
  `entity_name`   VARCHAR(255) DEFAULT NULL,
  `details`       TEXT         DEFAULT NULL,
  `details_json`  TEXT         DEFAULT NULL,
  `ip_address`    VARCHAR(45)  DEFAULT NULL,
  `created_at`    BIGINT       NOT NULL,
  INDEX `idx_at_company_action` (`company_id`, `action`),
  INDEX `idx_at_created`    (`created_at`),
  INDEX `idx_at_entity`     (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- BACKFILL (best-effort, lossless):
--   products          <- legacy atomic tradecore_products            (data JSON)
--   user_accounts     <- legacy atomic tradecore_users               (data JSON)
--   stock_categories  <- legacy atomic tradecore_categories          (plain cols)
--   companies/stores  <- backfilled at RUNTIME by api.php from the blob (their
--                        source of record is JSON inside tradecore_system_state,
--                        which cannot be unpacked reliably in portable SQL).
-- Each step uses INSERT IGNORE so repeated runs never duplicate rows, and stale
-- tombstones (deleted_at IS NOT NULL) are carried over.
-- ============================================================================

INSERT IGNORE INTO `products`
  (`id`, `company_id`, `store_id`, `category_id`, `sku`, `name`, `barcode`,
   `unit_price`, `cost_price`, `stock_qty`, `tax_rate`, `unit`, `image_url`,
   `description`, `is_active`, `created_at`, `updated_at`, `deleted_at`)
SELECT
  d.`id`,
  d.`company_id`,
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.storeId')),
  NULL,
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.sku')),
  COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.name')),
    JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.productName')),
    d.`id`
  ),
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.barcode')),
  COALESCE(JSON_EXTRACT(d.`data`, '$.price'), 0),
  COALESCE(JSON_EXTRACT(d.`data`, '$.costPrice'), JSON_EXTRACT(d.`data`, '$.unitCost'), 0),
  COALESCE(JSON_EXTRACT(d.`data`, '$.stockQty'), JSON_EXTRACT(d.`data`, '$.quantity'), 0),
  COALESCE(JSON_EXTRACT(d.`data`, '$.taxRate'), 0),
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.unit')),
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.image')),
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.description')),
  1,
  COALESCE(JSON_EXTRACT(d.`data`, '$.created_at'), UNIX_TIMESTAMP()),
  COALESCE(JSON_EXTRACT(d.`data`, '$.updated_at'), d.`updated_at`),
  d.`deleted_at`
FROM `tradecore_products` d ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);

INSERT IGNORE INTO `user_accounts`
  (`id`, `company_id`, `full_name`, `username`, `phone`, `email`, `role`,
   `password_hash`, `is_active`, `status`, `locale`, `created_at`, `updated_at`,
   `deleted_at`)
SELECT
  d.`id`,
  d.`company_id`,
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.fullName')),
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.username')),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.phone')), d.`phone`),
  JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.email')),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.role')), 'Cashier'),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.password')), JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.passwordHash'))),
  COALESCE(JSON_EXTRACT(d.`data`, '$.is_active'), 1),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.status')), 'active'),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.`data`, '$.locale')), 'en'),
  COALESCE(JSON_EXTRACT(d.`data`, '$.created_at'), UNIX_TIMESTAMP()),
  COALESCE(JSON_EXTRACT(d.`data`, '$.updated_at'), d.`updated_at`),
  d.`deleted_at`
FROM `tradecore_users` d ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);

INSERT IGNORE INTO `stock_categories`
  (`id`, `company_id`, `name`, `color`, `created_at`, `updated_at`, `deleted_at`)
SELECT
  CONCAT('c', c.`id`),
  c.`company_id`,
  c.`category_name`,
  '#f59e0b',
  c.`created_at`,
  c.`updated_at`,
  c.`deleted_at`
FROM `tradecore_categories` c ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);

-- ---------------------------------------------------------------------------
-- OPTIONAL FOREIGN KEYS — enable AFTER the first api.php sync has backfilled
-- parent rows. On a brand-new DB you can uncomment/run these immediately after
-- importing this file (INSERT order already inserts categories via auto ids).
-- ---------------------------------------------------------------------------
-- ALTER TABLE `stores`          ADD CONSTRAINT `fk_store_company`   FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);
-- ALTER TABLE `stock_categories` ADD CONSTRAINT `fk_sc_company`     FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);
-- ALTER TABLE `products`        ADD CONSTRAINT `fk_prod_company`    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);
-- ALTER TABLE `products`        ADD CONSTRAINT `fk_prod_store`      FOREIGN KEY (`store_id`)    REFERENCES `stores`(`id`);
-- ALTER TABLE `products`        ADD CONSTRAINT `fk_prod_category`   FOREIGN KEY (`category_id`) REFERENCES `stock_categories`(`id`);
-- ALTER TABLE `user_accounts`   ADD CONSTRAINT `fk_ua_company`      FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);
-- ALTER TABLE `audit_trails`    ADD CONSTRAINT `fk_at_company`      FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);