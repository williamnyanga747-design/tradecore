-- ============================================================================
-- TradeCore Manufacturing Industry Module Schema & Migration 006
-- Multi-Output Joint Products BOM, Invisible & Cleaning Loss, TBS QC Lab
-- Compatible with MySQL 5.7, 8.0, 8.4, and MariaDB (utf8mb4_unicode_ci)
-- ============================================================================

-- 1. BILL OF MATERIALS (BOM) MASTER
CREATE TABLE IF NOT EXISTS `boms` (
  `id`                     VARCHAR(64)  PRIMARY KEY,
  `company_id`             VARCHAR(64)  DEFAULT NULL,
  `name`                   VARCHAR(255) NOT NULL,
  `code`                   VARCHAR(64)  NOT NULL,
  `description`            TEXT         DEFAULT NULL,
  `category`               VARCHAR(100) DEFAULT 'Grain Milling',
  `base_quantity`          DECIMAL(12,4) NOT NULL DEFAULT 1000.0000,
  `cost_allocation_method` ENUM('by_weight', 'by_market_value', 'manual') NOT NULL DEFAULT 'by_market_value',
  `packaging_cost`         DECIMAL(15,2) DEFAULT 0.00,
  `labor_cost`             DECIMAL(15,2) DEFAULT 0.00,
  `overhead_cost`          DECIMAL(15,2) DEFAULT 0.00,
  `items_json`             LONGTEXT     DEFAULT NULL COMMENT 'Array of input raw materials',
  `is_active`              TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`             BIGINT       NOT NULL,
  `updated_at`             BIGINT       NOT NULL,
  INDEX `idx_bom_company` (`company_id`),
  INDEX `idx_bom_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BOM OUTPUTS (Joint Products & By-Products)
CREATE TABLE IF NOT EXISTS `bom_outputs` (
  `id`                    VARCHAR(64)  PRIMARY KEY,
  `bom_id`                VARCHAR(64)  NOT NULL,
  `product_id`            INT          NOT NULL,
  `product_name`          VARCHAR(255) DEFAULT NULL,
  `is_primary`            TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1=Primary finished good, 0=By-product',
  `expected_qty_kg`       DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  `expected_market_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `allocation_percent`    DECIMAL(6,2) DEFAULT NULL,
  `sort_order`            INT          DEFAULT 0,
  INDEX `idx_output_bom` (`bom_id`),
  INDEX `idx_output_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BATCH PRODUCTION RUNS (Live Runner with Invisible Loss Tracking)
CREATE TABLE IF NOT EXISTS `batch_production_runs` (
  `id`                      VARCHAR(64)  PRIMARY KEY,
  `run_number`              VARCHAR(64)  NOT NULL UNIQUE,
  `batch_number`            VARCHAR(64)  NOT NULL,
  `bom_id`                  VARCHAR(64)  NOT NULL,
  `bom_name`                VARCHAR(255) NOT NULL,
  `company_id`              VARCHAR(64)  DEFAULT NULL,
  `store_id`                INT          NOT NULL,
  `status`                  ENUM('Planned', 'In-Progress', 'Quality Check', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Planned',
  `planned_start_date`      VARCHAR(32)  NOT NULL,
  `actual_start_date`       VARCHAR(32)  DEFAULT NULL,
  `completed_date`          VARCHAR(32)  DEFAULT NULL,
  `expiry_date`             VARCHAR(32)  DEFAULT NULL,
  `notes`                   TEXT         DEFAULT NULL,
  
  -- Weight & Loss Analysis
  `input_weight_kg`         DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  `cleaning_loss_kg`        DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'Stones, dust from cleaner',
  `milling_scrap_kg`        DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'Spillage, startup scrap',
  `invisible_loss_kg`       DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'Auto-calculated moisture evaporation',
  `moisture_before_percent` DECIMAL(5,2)  DEFAULT NULL,
  `moisture_after_percent`  DECIMAL(5,2)  DEFAULT NULL,

  -- Financial Cost Allocation
  `raw_material_cost`       DECIMAL(15,2) DEFAULT 0.00,
  `packaging_cost`          DECIMAL(15,2) DEFAULT 0.00,
  `labor_cost`              DECIMAL(15,2) DEFAULT 0.00,
  `overhead_cost`           DECIMAL(15,2) DEFAULT 0.00,
  `total_batch_cost`        DECIMAL(15,2) DEFAULT 0.00,

  -- Outputs & Yield
  `total_output_kg`         DECIMAL(12,4) DEFAULT 0.0000,
  `yield_percent`           DECIMAL(6,2)  DEFAULT 0.00,
  `outputs_json`            LONGTEXT      DEFAULT NULL COMMENT 'Array of actual produced outputs with allocated unit costs',
  
  -- Quality Check
  `qc_check_id`             VARCHAR(64)   DEFAULT NULL,
  `qc_status`               VARCHAR(32)   DEFAULT 'Pending',

  `created_at`              BIGINT        NOT NULL,
  `updated_at`              BIGINT        NOT NULL,
  INDEX `idx_run_batch` (`batch_number`),
  INDEX `idx_run_company` (`company_id`),
  INDEX `idx_run_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. QUALITY CONTROL TEMPLATES (TBS - Tanzania Bureau of Standards)
CREATE TABLE IF NOT EXISTS `qc_templates` (
  `id`                  VARCHAR(64)  PRIMARY KEY,
  `company_id`          VARCHAR(64)  DEFAULT NULL,
  `name`                VARCHAR(255) NOT NULL,
  `product_category_id` VARCHAR(64)  DEFAULT NULL,
  `product_id`          INT          DEFAULT NULL,
  `standard_ref`        VARCHAR(100) DEFAULT 'TZS 438:2021 / EAS 44',
  `parameters_json`     LONGTEXT     DEFAULT NULL,
  `is_active`           TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`          BIGINT       NOT NULL,
  `updated_at`          BIGINT       NOT NULL,
  INDEX `idx_qc_tmpl_comp` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. QC TEMPLATE PARAMETERS
CREATE TABLE IF NOT EXISTS `qc_template_parameters` (
  `id`          VARCHAR(64)  PRIMARY KEY,
  `template_id` VARCHAR(64)  NOT NULL,
  `param_name`  VARCHAR(100) NOT NULL,
  `unit`        VARCHAR(32)  NOT NULL DEFAULT '%',
  `min_value`   DECIMAL(10,3) DEFAULT NULL,
  `max_value`   DECIMAL(10,3) DEFAULT NULL,
  `target_value` DECIMAL(10,3) DEFAULT NULL,
  `is_critical` TINYINT(1)   NOT NULL DEFAULT 1,
  `sort_order`  INT          DEFAULT 0,
  INDEX `idx_qcp_tmpl` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BATCH QC CHECKS (Lab Results & Auto-Decision)
CREATE TABLE IF NOT EXISTS `batch_qc_checks` (
  `id`                     VARCHAR(64)  PRIMARY KEY,
  `run_id`                 VARCHAR(64)  NOT NULL,
  `batch_number`           VARCHAR(64)  NOT NULL,
  `product_name`           VARCHAR(255) NOT NULL,
  `template_id`            VARCHAR(64)  NOT NULL,
  `template_name`          VARCHAR(255) NOT NULL,
  `lab_results_json`       LONGTEXT     NOT NULL,
  `auto_decision`          ENUM('Passed', 'Passed with Variance', 'Rework Required', 'Rejected') NOT NULL,
  `final_decision`         ENUM('Passed', 'Passed with Variance', 'Rework Required', 'Rejected') NOT NULL,
  `is_overridden`          TINYINT(1)   DEFAULT 0,
  `override_reason`        TEXT         DEFAULT NULL,
  `override_by`            VARCHAR(100) DEFAULT NULL,
  `inspector_id`           VARCHAR(64)  NOT NULL,
  `inspector_name`         VARCHAR(160) NOT NULL,
  `inspector_role`         VARCHAR(64)  DEFAULT 'QC Lab Officer',
  `signature`              TEXT         NOT NULL,
  `check_date`             VARCHAR(32)  NOT NULL,
  `compliance_cert_number` VARCHAR(64)  DEFAULT NULL,
  `notes`                  TEXT         DEFAULT NULL,
  `created_at`             BIGINT       NOT NULL,
  `updated_at`             BIGINT       NOT NULL,
  INDEX `idx_bqc_run` (`run_id`),
  INDEX `idx_bqc_batch` (`batch_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
