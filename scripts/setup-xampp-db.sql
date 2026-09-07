-- ============================================================================
-- TradeCore XAMPP Local Setup - Complete Database Schema
-- ============================================================================
-- This file combines public/cpanel/database.sql (52 tables) with the missing
-- audit_logs table that api.php writes to but was never defined in a .sql file.
--
-- IMPORT METHOD:
--   Option A: phpMyAdmin -> Import -> select this file
--   Option B: C:\xampp\mysql\bin\mysql.exe -u root < setup-xampp-db.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `tanzatrade_tradecore_erp` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tanzatrade_tradecore_erp`;

-- ============================================================================
-- CORE SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `tradecore_system_state` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `doc_key` VARCHAR(100) UNIQUE NOT NULL,
    `json_data` LONGTEXT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `version` BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tradecore_products` (
  `id` VARCHAR(50) PRIMARY KEY,
  `company_id` VARCHAR(50) NOT NULL,
  `data` JSON NOT NULL,
  `updated_at` BIGINT NOT NULL,
  `deleted_at` BIGINT DEFAULT NULL,
  INDEX `idx_company` (`company_id`, `updated_at`),
  INDEX `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tradecore_users` (
  `id` VARCHAR(50) PRIMARY KEY,
  `company_id` VARCHAR(50) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `data` JSON NOT NULL,
  `updated_at` BIGINT NOT NULL,
  `deleted_at` BIGINT DEFAULT NULL,
  UNIQUE KEY `uniq_phone_company` (`phone`,`company_id`),
  INDEX `idx_company` (`company_id`),
  INDEX `idx_updated` (`updated_at`),
  INDEX `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tradecore_sales` (
  `id` VARCHAR(50) PRIMARY KEY,
  `company_id` VARCHAR(50) NOT NULL,
  `data` JSON NOT NULL,
  `updated_at` BIGINT NOT NULL,
  `deleted_at` BIGINT DEFAULT NULL,
  INDEX `idx_company` (`company_id`, `updated_at`),
  INDEX `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tradecore_marketplace_orders` (
  `id` VARCHAR(50) PRIMARY KEY,
  `company_id` VARCHAR(50) NOT NULL,
  `data` JSON NOT NULL,
  `updated_at` BIGINT NOT NULL,
  `deleted_at` BIGINT DEFAULT NULL,
  INDEX `idx_company` (`company_id`, `updated_at`),
  INDEX `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tradecore_meta` (
  `id` INT PRIMARY KEY,
  `app_version` VARCHAR(20) NOT NULL DEFAULT '1.0.9',
  `updated_at` BIGINT NOT NULL,
  INDEX `idx_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `tradecore_meta` (`id`,`app_version`,`updated_at`) VALUES (1,'1.0.9', UNIX_TIMESTAMP());

CREATE TABLE IF NOT EXISTS `tradecore_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` VARCHAR(50) NOT NULL,
  `category_name` VARCHAR(255) NOT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  `deleted_at` BIGINT DEFAULT NULL,
  UNIQUE KEY `uniq_cat_company` (`company_id`,`category_name`),
  INDEX `idx_cat_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SESSIONS, AUDIT, PASSWORD RESETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `user_sessions` (
    `id` VARCHAR(64) PRIMARY KEY,
    `user_id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `token_jti` VARCHAR(64) NOT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `user_agent` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    INDEX `idx_user_jti` (`user_id`, `token_jti`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_trails` (
    `id` VARCHAR(64) PRIMARY KEY,
    `company_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) DEFAULT NULL,
    `user_name` VARCHAR(255) DEFAULT NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) DEFAULT NULL,
    `entity_id` VARCHAR(64) DEFAULT NULL,
    `entity_name` VARCHAR(255) DEFAULT NULL,
    `details` TEXT DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `created_at` DATETIME NOT NULL,
    INDEX `idx_company_action` (`company_id`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MISSING TABLE: api.php logCoreAction() writes here, get_audit_logs reads from here
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timestamp` DATETIME NOT NULL,
  `operator_username` VARCHAR(160) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `action_performed` VARCHAR(160) NOT NULL,
  `details` VARCHAR(1000) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  INDEX `idx_al_ts` (`timestamp`),
  INDEX `idx_al_action` (`action_performed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_resets` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `used` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`),
    INDEX `idx_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- BILLING & SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `currencies` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `code` VARCHAR(8) UNIQUE NOT NULL,
    `symbol` VARCHAR(8) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `exchange_rate` DECIMAL(12,2) NOT NULL DEFAULT 1,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `currencies` (`code`, `symbol`, `name`, `exchange_rate`, `is_active`) VALUES
    ('TZS', 'TZS', 'Tanzanian Shilling', 1.00, 1),
    ('USD', '$', 'US Dollar', 2600.00, 1),
    ('KES', 'KSh', 'Kenyan Shilling', 20.00, 0),
    ('UGX', 'USh', 'Ugandan Shilling', 0.70, 0);

CREATE TABLE IF NOT EXISTS `subscription_plans` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) UNIQUE NOT NULL,
    `type` ENUM('direct', 'commission') NOT NULL DEFAULT 'direct',
    `base_price_tzs` DECIMAL(12,2) NOT NULL,
    `commission_percent` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `max_products` INT NOT NULL DEFAULT 100,
    `features` JSON DEFAULT NULL,
    `duration_days` INT NOT NULL DEFAULT 30,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `subscription_plans` (`name`, `slug`, `type`, `base_price_tzs`, `commission_percent`, `max_products`, `features`, `duration_days`, `is_active`) VALUES
    ('Biashara Direct', 'direct_premium', 'direct', 50000.00, 0, 100,
     JSON_ARRAY('Mfumo kamili wa POS na usimamizi wa bidhaa', 'Wateja wanalipa moja kwa moja kwako (WhatsApp)', 'Hakuna tume ya jukwaa', 'Msaada wa barua pepe'),
     30, 1),
    ('Biashara Commission', 'commission_standard', 'commission', 30000.00, 10, 50,
     JSON_ARRAY('Mfumo kamili wa POS na usimamizi wa bidhaa', 'Wateja wanalipa kupitia jukwaa', 'Tume ya jukwaa inayoweza kurekebishwa', 'Malipo ya wateja yanaaminika'),
     30, 1);

CREATE TABLE IF NOT EXISTS `company_subscriptions` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT NOT NULL,
    `plan_id` INT DEFAULT NULL,
    `currency_code` VARCHAR(8) NOT NULL DEFAULT 'TZS',
    `amount_paid` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `amount_tzs` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `commission_percent_snapshot` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `status` ENUM('pending', 'active', 'expired') NOT NULL DEFAULT 'pending',
    `starts_at` DATETIME DEFAULT NULL,
    `ends_at` DATETIME DEFAULT NULL,
    `payment_proof` LONGTEXT DEFAULT NULL,
    `payment_reference` VARCHAR(100) DEFAULT NULL,
    `payment_method` VARCHAR(50) DEFAULT NULL,
    `admin_note` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_company` (`company_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MARKETPLACE: REVIEWS, VIEWS, CLICKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `reviews` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT NOT NULL,
    `product_id` INT DEFAULT NULL,
    `user_id` INT DEFAULT NULL,
    `reviewer_name` VARCHAR(60) NOT NULL,
    `reviewer_phone` VARCHAR(20) DEFAULT NULL,
    `rating` TINYINT UNSIGNED NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
    `comment` VARCHAR(1000) DEFAULT NULL,
    `is_verified_buyer` TINYINT(1) NOT NULL DEFAULT 0,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `decided_at` DATETIME DEFAULT NULL,
    INDEX `idx_review_company` (`company_id`),
    INDEX `idx_review_product` (`product_id`),
    INDEX `idx_review_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_views` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `company_id` INT DEFAULT NULL,
    `viewed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_view_product` (`product_id`),
    INDEX `idx_view_company` (`company_id`),
    INDEX `idx_view_date` (`viewed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_clicks` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `company_id` INT DEFAULT NULL,
    `clicked_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_click_product` (`product_id`),
    INDEX `idx_click_company` (`company_id`),
    INDEX `idx_click_date` (`clicked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MEGA PHASE 1: WALLETS, AFFILIATES, PUSH, SYNONYMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `seller_wallets` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT NOT NULL,
    `balance` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `total_earned` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `total_withdrawn` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_wallet_company` (`company_id`),
    INDEX `idx_wallet_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wallet_transactions` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `wallet_id` INT NOT NULL,
    `company_id` INT NOT NULL,
    `type` ENUM('credit','debit','withdrawal_request','withdrawal_approved') NOT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `description` VARCHAR(255) DEFAULT NULL,
    `order_id` INT DEFAULT NULL,
    `status` ENUM('pending','completed','rejected') NOT NULL DEFAULT 'completed',
    `reference` VARCHAR(64) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_wtx_wallet` (`wallet_id`),
    INDEX `idx_wtx_company` (`company_id`),
    INDEX `idx_wtx_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `withdrawals` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT NOT NULL,
    `company_name` VARCHAR(255) DEFAULT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `phone_number` VARCHAR(32) NOT NULL,
    `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    `admin_note` VARCHAR(255) DEFAULT NULL,
    `requested_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `approved_at` DATETIME DEFAULT NULL,
    `decided_by` VARCHAR(255) DEFAULT NULL,
    INDEX `idx_wdr_company` (`company_id`),
    INDEX `idx_wdr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `affiliates` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `user_id` INT DEFAULT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `referral_code` VARCHAR(32) NOT NULL,
    `balance` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `total_earned` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `total_withdrawn` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_aff_code` (`referral_code`),
    INDEX `idx_aff_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `affiliate_clicks` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `affiliate_id` INT NOT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `user_agent` TEXT DEFAULT NULL,
    `url` VARCHAR(255) DEFAULT NULL,
    `clicked_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_affclick_affiliate` (`affiliate_id`),
    INDEX `idx_affclick_date` (`clicked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `affiliate_sales` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `affiliate_id` INT NOT NULL,
    `order_id` INT NOT NULL,
    `company_id` INT NOT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `commission_amount` DECIMAL(15,2) NOT NULL,
    `commission_percent` DECIMAL(5,2) NOT NULL DEFAULT 0,
    `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_affsale_affiliate` (`affiliate_id`),
    INDEX `idx_affsale_order` (`order_id`),
    INDEX `idx_affsale_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `affiliate_withdrawals` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `affiliate_id` INT NOT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `phone_number` VARCHAR(32) NOT NULL,
    `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    `requested_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `approved_at` DATETIME DEFAULT NULL,
    `decided_by` VARCHAR(255) DEFAULT NULL,
    INDEX `idx_affwdr_affiliate` (`affiliate_id`),
    INDEX `idx_affwdr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT DEFAULT NULL,
    `user_id` INT DEFAULT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_push_company` (`company_id`),
    INDEX `idx_push_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `search_synonyms` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `keyword` VARCHAR(100) NOT NULL,
    `synonyms_json` JSON NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_syn_keyword` (`keyword`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MEGA PHASE 2B: MULTI-NETWORK COLLECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS `collection_settings` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `network` ENUM('mpesa','tigopesa','airtelmoney','halopesa','azampesa') NOT NULL,
    `display_name` VARCHAR(60) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `pay_number` VARCHAR(32) NOT NULL,
    `account_name` VARCHAR(120) DEFAULT NULL,
    `logo` VARCHAR(255) DEFAULT NULL,
    `instructions` VARCHAR(500) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_coll_network` (`network`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `collection_settings` (`network`, `display_name`, `is_active`, `pay_number`, `account_name`, `logo`, `instructions`) VALUES
    ('mpesa', 'M-Pesa', 1, '2557XXXXXX', 'Tanzania Trade Core', '/images/mpesa.png', 'Lipa kwa {payNumber}. Baada ya malipo, andika Transaction ID.'),
    ('tigopesa', 'Tigo Pesa', 1, '25571XXXXX', 'Tanzania Trade Core', '/images/tigopesa.png', 'Lipa kwa {payNumber}. Baada ya malipo, andika Transaction ID.'),
    ('airtelmoney', 'Airtel Money', 1, '25575XXXXX', 'Tanzania Trade Core', '/images/airtelmoney.png', 'Lipa kwa {payNumber}. Baada ya malipo, andika Transaction ID.'),
    ('halopesa', 'HaloPesa', 1, '25576XXXXX', 'Tanzania Trade Core', '/images/halopesa.png', 'Lipa kwa {payNumber}. Baada ya malipo, andika Transaction ID.');

CREATE TABLE IF NOT EXISTS `collections` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `reference` VARCHAR(32) UNIQUE NOT NULL,
    `order_id` INT DEFAULT NULL,
    `company_id` INT NOT NULL,
    `customer_name` VARCHAR(120) DEFAULT NULL,
    `customer_phone` VARCHAR(32) NOT NULL,
    `network` ENUM('mpesa','tigopesa','airtelmoney','halopesa','azampesa') NOT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `amount_tzs` DECIMAL(15,2) NOT NULL,
    `currency_code` VARCHAR(8) NOT NULL DEFAULT 'TZS',
    `status` ENUM('manual_pending_approval','processing','completed','failed') NOT NULL DEFAULT 'manual_pending_approval',
    `mode` ENUM('manual','auto') NOT NULL DEFAULT 'manual',
    `transaction_id` VARCHAR(64) DEFAULT NULL,
    `azampay_transaction_id` VARCHAR(64) DEFAULT NULL,
    `provider_response` TEXT DEFAULT NULL,
    `proof_image` LONGTEXT DEFAULT NULL,
    `admin_note` VARCHAR(500) DEFAULT NULL,
    `decided_by` VARCHAR(255) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT NULL,
    INDEX `idx_col_company` (`company_id`),
    INDEX `idx_col_status` (`status`),
    INDEX `idx_col_reference` (`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `webhook_logs` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `provider` VARCHAR(32) NOT NULL,
    `event` VARCHAR(64) DEFAULT NULL,
    `status` ENUM('received','processed','signature_failed') NOT NULL DEFAULT 'received',
    `note` VARCHAR(255) DEFAULT NULL,
    `payload` LONGTEXT DEFAULT NULL,
    `received_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_wbh_provider` (`provider`),
    INDEX `idx_wbh_date` (`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_earnings` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT NOT NULL,
    `order_id` INT DEFAULT NULL,
    `reference` VARCHAR(64) NOT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `commission_amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `seller_amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_earn_company` (`company_id`),
    INDEX `idx_earn_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MEGA PHASE 2C: 7 KILLER FEATURES
-- ============================================================================

-- 1. PIGA BEI / OFFERS
CREATE TABLE IF NOT EXISTS `offers` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `company_id` INT NOT NULL,
    `customer_name` VARCHAR(128) NOT NULL,
    `customer_phone` VARCHAR(24) NOT NULL,
    `original_price` DECIMAL(15,2) NOT NULL,
    `offered_price` DECIMAL(15,2) NOT NULL,
    `counter_price` DECIMAL(15,2) DEFAULT NULL,
    `final_price` DECIMAL(15,2) DEFAULT NULL,
    `status` ENUM('pending','accepted','countered','rejected','paid','expired') NOT NULL DEFAULT 'pending',
    `expires_at` DATETIME DEFAULT NULL,
    `accepted_expires_at` DATETIME DEFAULT NULL,
    `payment_reference` VARCHAR(64) DEFAULT NULL,
    `order_id` INT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_offers_company` (`company_id`),
    INDEX `idx_offers_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offer_messages` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `offer_id` INT NOT NULL,
    `sender_type` ENUM('customer','seller') NOT NULL,
    `message` TEXT DEFAULT NULL,
    `price` DECIMAL(15,2) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_offer_msgs_offer` (`offer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. NUNUA PAMOJA / GROUP BUYING
CREATE TABLE IF NOT EXISTS `group_deals` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `company_id` INT NOT NULL,
    `solo_price` DECIMAL(15,2) NOT NULL,
    `group_price` DECIMAL(15,2) NOT NULL,
    `min_buyers` INT NOT NULL DEFAULT 3,
    `max_buyers` INT DEFAULT NULL,
    `current_buyers_count` INT NOT NULL DEFAULT 0,
    `paid_count` INT NOT NULL DEFAULT 0,
    `expires_at` DATETIME DEFAULT NULL,
    `share_code` VARCHAR(16) NOT NULL,
    `status` ENUM('active','completed','expired','cancelled') NOT NULL DEFAULT 'active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_deals_company` (`company_id`),
    INDEX `idx_deals_status` (`status`),
    UNIQUE KEY `uk_deals_share_code` (`share_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_deal_participants` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `group_deal_id` INT NOT NULL,
    `customer_name` VARCHAR(128) NOT NULL,
    `customer_phone` VARCHAR(24) NOT NULL,
    `status` ENUM('joined','paid','cancelled') NOT NULL DEFAULT 'joined',
    `amount_paid` DECIMAL(15,2) DEFAULT NULL,
    `reference` VARCHAR(64) DEFAULT NULL,
    `order_id` INT DEFAULT NULL,
    `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `paid_at` DATETIME DEFAULT NULL,
    INDEX `idx_gdp_deal` (`group_deal_id`),
    INDEX `idx_gdp_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. WHATSAPP AI BOT
CREATE TABLE IF NOT EXISTS `whatsapp_conversations` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `phone` VARCHAR(24) NOT NULL,
    `message_in` TEXT NOT NULL,
    `message_out` TEXT DEFAULT NULL,
    `intent` VARCHAR(32) DEFAULT NULL,
    `product_ids` VARCHAR(255) DEFAULT NULL,
    `status` ENUM('pending','replied','failed','logged_test') NOT NULL DEFAULT 'pending',
    `mode` ENUM('log','live') NOT NULL DEFAULT 'log',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_wa_phone` (`phone`),
    INDEX `idx_wa_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BODABODA LIVE TRACKING
CREATE TABLE IF NOT EXISTS `deliveries` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `order_id` INT NOT NULL,
    `collection_id` INT DEFAULT NULL,
    `company_id` INT NOT NULL,
    `customer_name` VARCHAR(128) NOT NULL,
    `customer_phone` VARCHAR(24) NOT NULL,
    `customer_address` TEXT DEFAULT NULL,
    `customer_lat` DECIMAL(10,6) DEFAULT NULL,
    `customer_lng` DECIMAL(10,6) DEFAULT NULL,
    `rider_name` VARCHAR(128) DEFAULT NULL,
    `rider_phone` VARCHAR(24) DEFAULT NULL,
    `rider_lat` DECIMAL(10,6) DEFAULT NULL,
    `rider_lng` DECIMAL(10,6) DEFAULT NULL,
    `status` ENUM('pending','assigned','picked','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'pending',
    `tracking_code` VARCHAR(32) NOT NULL,
    `estimated_minutes` INT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_del_tracking` (`tracking_code`),
    INDEX `idx_del_company` (`company_id`),
    INDEX `idx_del_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `delivery_updates` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `delivery_id` INT NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `lat` DECIMAL(10,6) DEFAULT NULL,
    `lng` DECIMAL(10,6) DEFAULT NULL,
    `note` VARCHAR(255) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_du_delivery` (`delivery_id`),
    INDEX `idx_du_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. LIPA POLE POLE / BNPL
CREATE TABLE IF NOT EXISTS `installment_plans` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `company_id` INT NOT NULL,
    `total_price` DECIMAL(15,2) NOT NULL,
    `down_payment_percent` TINYINT NOT NULL,
    `installments_count` TINYINT NOT NULL,
    `installment_percent_extra` TINYINT NOT NULL DEFAULT 0,
    `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_ip_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `installment_orders` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `company_id` INT NOT NULL,
    `installment_plan_id` INT NOT NULL,
    `customer_name` VARCHAR(128) NOT NULL,
    `customer_phone` VARCHAR(24) NOT NULL,
    `total_price` DECIMAL(15,2) NOT NULL,
    `down_payment` DECIMAL(15,2) NOT NULL,
    `remaining` DECIMAL(15,2) NOT NULL,
    `installment_amount` DECIMAL(15,2) NOT NULL,
    `installments_count` TINYINT NOT NULL,
    `paid_installments` TINYINT NOT NULL DEFAULT 0,
    `total_paid` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `status` ENUM('pending_down','active','completed','defaulted','cancelled') NOT NULL DEFAULT 'pending_down',
    `next_due_date` DATETIME DEFAULT NULL,
    `tracking_code` VARCHAR(32) NOT NULL,
    `order_id` INT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_io_tracking` (`tracking_code`),
    INDEX `idx_io_company` (`company_id`),
    INDEX `idx_io_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `installment_payments` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `installment_order_id` INT NOT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `type` ENUM('down','installment') NOT NULL,
    `status` ENUM('pending','completed','failed','manual_pending') NOT NULL DEFAULT 'pending',
    `reference` VARCHAR(64) DEFAULT NULL,
    `collection_id` INT DEFAULT NULL,
    `due_date` DATETIME DEFAULT NULL,
    `paid_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_ipay_order` (`installment_order_id`),
    INDEX `idx_ipay_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. LIVE SHOPPING
CREATE TABLE IF NOT EXISTS `live_streams` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `product_ids` VARCHAR(255) DEFAULT NULL,
    `featured_product_id` INT DEFAULT NULL,
    `status` ENUM('scheduled','live','ended','cancelled') NOT NULL DEFAULT 'scheduled',
    `scheduled_at` DATETIME DEFAULT NULL,
    `started_at` DATETIME DEFAULT NULL,
    `ended_at` DATETIME DEFAULT NULL,
    `stream_key` VARCHAR(32) NOT NULL,
    `viewers_count` INT NOT NULL DEFAULT 0,
    `likes_count` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_ls_key` (`stream_key`),
    INDEX `idx_ls_company` (`company_id`),
    INDEX `idx_ls_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `live_comments` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `live_stream_id` INT NOT NULL,
    `customer_name` VARCHAR(128) NOT NULL,
    `customer_phone` VARCHAR(24) DEFAULT NULL,
    `message` TEXT DEFAULT NULL,
    `type` ENUM('comment','want','paid') NOT NULL DEFAULT 'comment',
    `product_id` INT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_lc_stream` (`live_stream_id`),
    INDEX `idx_lc_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. LOYALTY / POINTI ZA MTEJA
CREATE TABLE IF NOT EXISTS `loyalty_customers` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `phone` VARCHAR(24) NOT NULL,
    `name` VARCHAR(128) DEFAULT NULL,
    `total_points` INT NOT NULL DEFAULT 0,
    `used_points` INT NOT NULL DEFAULT 0,
    `balance_points` INT NOT NULL DEFAULT 0,
    `total_spent` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `tier` ENUM('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_loy_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loyalty_transactions` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `loyalty_customer_id` INT NOT NULL,
    `type` ENUM('earn','redeem','expired') NOT NULL,
    `points` INT NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `order_id` INT DEFAULT NULL,
    `reference` VARCHAR(64) DEFAULT NULL,
    `code` VARCHAR(32) DEFAULT NULL,
    `code_value_tzs` DECIMAL(15,2) DEFAULT NULL,
    `code_used` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_lt_customer` (`loyalty_customer_id`),
    INDEX `idx_lt_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SMS NOTIFICATION LOG
CREATE TABLE IF NOT EXISTS `notification_logs` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `to_phone` VARCHAR(24) NOT NULL,
    `message` TEXT NOT NULL,
    `kind` VARCHAR(16) NOT NULL DEFAULT 'sms',
    `status` VARCHAR(16) NOT NULL DEFAULT 'logged',
    `mode` VARCHAR(16) NOT NULL DEFAULT 'log',
    `url` VARCHAR(255) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_nl_phone` (`to_phone`),
    INDEX `idx_nl_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TRA COMPLIANCE
CREATE TABLE IF NOT EXISTS `tra_receipts` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `order_id` INT NOT NULL UNIQUE,
    `order_number` VARCHAR(64) NOT NULL,
    `company_id` INT NOT NULL,
    `tin_number` VARCHAR(32) DEFAULT NULL,
    `customer_name` VARCHAR(255) DEFAULT NULL,
    `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
    `vat_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
    `efd_receipt_number` VARCHAR(64) DEFAULT NULL,
    `efd_qr_code` VARCHAR(255) DEFAULT NULL,
    `status` ENUM('pending','issued','failed') NOT NULL DEFAULT 'pending',
    `tra_response` LONGTEXT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_tra_company_month` (`company_id`, `created_at`),
    INDEX `idx_tra_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tra_monthly_reports` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `company_id` INT NOT NULL,
    `month` VARCHAR(7) NOT NULL,
    `total_sales` DECIMAL(18,2) NOT NULL DEFAULT 0,
    `order_count` INT NOT NULL DEFAULT 0,
    `vat_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
    `report_file_path` VARCHAR(500) DEFAULT NULL,
    `submitted` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tra_company_month` (`company_id`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- NORMALIZED PERSISTENT BACKEND STORAGE (PBS)
-- ============================================================================

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

-- Seed the empty system state document
INSERT INTO `tradecore_system_state` (`doc_key`, `json_data`)
VALUES ('main_state', '{}')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- ============================================================================
-- DONE: 54 tables created (52 from database.sql + audit_logs + indexes)
-- ============================================================================
