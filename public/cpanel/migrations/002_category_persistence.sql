-- ============================================================================
-- Migration 002 — Per-Company Category Persistence
-- Project : TradeCore ERP (Tanzania Trade Core)
-- Purpose : Guarantee Stock Categories survive refresh / company switches /
--           blob clobbering by persisting every category as an explicit MySQL row
--           bound to its company_id (with created_at/updated_at timestamps).
--
-- ARCHITECTURE NOTE
-- -----------------
-- Categories (like stores/companies/taxes) live inside the single
-- tradecore_system_state JSON blob as company-scoped strings "co_<companyId>:<name>".
-- api.php's save_state now mirrors every merged category into THIS table
-- (tcMirrorCategories) and get_state rebuilds the blob's categories from it
-- (tcLoadCategories), making the table the source of truth on fetch. The table is
-- created defensively by api.php at runtime too (self-healing), so this migration is
-- optional — run it to pre-provision the table + indexes.
--
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS `tradecore_categories` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `company_id`    VARCHAR(50)  NOT NULL,
  `category_name` VARCHAR(255) NOT NULL,
  `created_at`    BIGINT       NOT NULL,
  `updated_at`    BIGINT       NOT NULL,
  `deleted_at`    BIGINT       DEFAULT NULL,
  UNIQUE KEY `uniq_cat_company` (`company_id`, `category_name`),
  INDEX `idx_cat_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- Backfill: pull whatever categories exist today out of the live blob (doc_key
-- 'main_state', JSON key 'categories') into per-company rows. Each entry is a
-- "co_<companyId>:<name>" string; plain legacy names map to company 1. This is a
-- one-time safety net — after the FIRST save_state the mirror keeps it identical,
-- and the get_state blob fallback already serves blob categories until then.
-- Valid MySQL 5.7+ / MariaDB 10.2+ (numbers table cross join, no CTEs).
-- ============================================================================
INSERT IGNORE INTO `tradecore_categories` (`company_id`, `category_name`, `created_at`, `updated_at`)
SELECT
  CASE
    WHEN `sk`.`cname` REGEXP '^co_[0-9]+:' THEN SUBSTRING_INDEX(SUBSTRING_INDEX(`sk`.`cname`, ':', 1), '_', -1)
    ELSE '1'
  END AS `company_id`,
  CASE
    WHEN `sk`.`cname` REGEXP '^co_[0-9]+:' THEN SUBSTRING(`sk`.`cname`, LOCATE(':', `sk`.`cname`) + 1)
    ELSE `sk`.`cname`
  END AS `category_name`,
  UNIX_TIMESTAMP() AS `created_at`,
  UNIX_TIMESTAMP() AS `updated_at`
FROM (
  SELECT JSON_UNQUOTE(JSON_EXTRACT(`bs`.`json_data`, CONCAT('$.categories[', `nums`.`n`, ']'))) AS `cname`
  FROM `tradecore_system_state` `bs`
  JOIN (
    SELECT (@r := @r + 1) - 1 AS `n`
    FROM (SELECT @r := 0) `r0`,
         (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) `t1`,
         (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) `t2`,
         (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) `t3`,
         (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) `t4`
  ) `nums`
    ON JSON_LENGTH(JSON_EXTRACT(`bs`.`json_data`, '$.categories')) > `nums`.`n`
  WHERE `bs`.`doc_key` = 'main_state'
    AND `bs`.`json_data` IS NOT NULL
) `sk`
WHERE `sk`.`cname` IS NOT NULL AND `sk`.`cname` <> '';