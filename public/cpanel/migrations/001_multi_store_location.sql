-- ============================================================================
-- Migration 001 — Multi-Store Location Mapping
-- Project : TradeCore ERP (Tanzania Trade Core)
-- Purpose : Extend physical store records with GPS / map / visibility / hours so
--           Marketplace products can render dynamic per-store pins on the public
--           Leaflet map (with Main HQ fallback from Marketplace Settings -> Store Profile).
--
-- IMPORTANT ARCHITECTURE NOTE
-- ---------------------------
-- In the current app, `stores` (like companies, branches, categories, taxes, ...)
-- are NOT stored in a dedicated SQL table. They are persisted as JSON inside the
-- single `tradecore_system_state` blob (doc_key = 'main_state') and mirrored through
-- the `save_state` API. The actual schema upgrade therefore happens on the FRONTEND:
--   * src/types.ts          : Store interface gains latitude/longitude/googleMapsUrl/
--                             isMarketplaceVisible/operatingHours (DONE)
--   * Master Data store UI : the Add/Edit Store modal saves those fields (DONE)
-- and the values travel untouched through the existing saveAllData -> save_state
-- blob pipeline (no ALTER required for the blob path).
--
-- This script is provided as a DEFENSIVE, idempotent migration for any deployment
-- that maintains a dedicated physical `stores` table (e.g. a legacy/2nd database or
-- a custom integration). It is safe to run even when the table does not exist yet.
-- ============================================================================

-- 1) Create the stores table if it does not already exist (blob deployments that
--    want an indexed mirror can use this as the canonical physical table).
CREATE TABLE IF NOT EXISTS `stores` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `branch_id`     INT NOT NULL DEFAULT 0,
  `name`          VARCHAR(255) NOT NULL DEFAULT '',
  `location`      VARCHAR(255) NOT NULL DEFAULT '',
  `phone`         VARCHAR(50)  DEFAULT NULL,
  `latitude`      DECIMAL(10, 7)          DEFAULT NULL,
  `longitude`     DECIMAL(10, 7)          DEFAULT NULL,
  `google_maps_url` VARCHAR(500)          DEFAULT NULL,
  `is_marketplace_visible` TINYINT(1)     NOT NULL DEFAULT 1,
  `operating_hours` VARCHAR(120)          DEFAULT NULL,
  `is_deleted`    TINYINT(1)  NOT NULL DEFAULT 0,
  `created_at`    DATETIME    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stores_branch` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Idempotently extend an ALREADY-EXISTING `stores` table with the new columns
--    (each ADD COLUMN is guarded so it never fails if the column is already present).
--    Note: MySQL 8.0.29+ supports stored procedures for conditional DDL; this generic
--    form uses 'IF NOT EXISTS' where supported (MariaDB / MySQL 8) and is wrapped so a
--    missing table simply no-ops on the ALTER while still creating via CREATE above.
SET @has_stores := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'stores'
);

SET @sql_lat := IF(@has_stores > 0,
  'ALTER TABLE `stores` ADD COLUMN IF NOT EXISTS `latitude` DECIMAL(10,7) DEFAULT NULL AFTER `phone`',
  'SELECT 1');
PREPARE st1 FROM @sql_lat; EXECUTE st1; DEALLOCATE PREPARE st1;

SET @sql_lng := IF(@has_stores > 0,
  'ALTER TABLE `stores` ADD COLUMN IF NOT EXISTS `longitude` DECIMAL(10,7) DEFAULT NULL AFTER `latitude`',
  'SELECT 1');
PREPARE st2 FROM @sql_lng; EXECUTE st2; DEALLOCATE PREPARE st2;

SET @sql_gm := IF(@has_stores > 0,
  'ALTER TABLE `stores` ADD COLUMN IF NOT EXISTS `google_maps_url` VARCHAR(500) DEFAULT NULL AFTER `longitude`',
  'SELECT 1');
PREPARE st3 FROM @sql_gm; EXECUTE st3; DEALLOCATE PREPARE st3;

SET @sql_vis := IF(@has_stores > 0,
  'ALTER TABLE `stores` ADD COLUMN IF NOT EXISTS `is_marketplace_visible` TINYINT(1) NOT NULL DEFAULT 1 AFTER `google_maps_url`',
  'SELECT 1');
PREPARE st4 FROM @sql_vis; EXECUTE st4; DEALLOCATE PREPARE st4;

SET @sql_hours := IF(@has_stores > 0,
  'ALTER TABLE `stores` ADD COLUMN IF NOT EXISTS `operating_hours` VARCHAR(120) DEFAULT NULL AFTER `is_marketplace_visible`',
  'SELECT 1');
PREPARE st5 FROM @sql_hours; EXECUTE st5; DEALLOCATE PREPARE st5;

-- ============================================================================
-- Backend payload structure (mirrors the JSON blob so per-column mapping is 1:1)
-- ============================================================================
-- A store record now carries the following keys (all optional except id/branchId):
--
--   {
--     "id": 3,
--     "branchId": 2,
--     "name": "DSM Store Alpha",
--     "location": "Mtaa wa Kariakoo 12, Ilala",
--     "phone": "+255712345678",
--     "latitude": -6.8175,
--     "longitude": 39.2732,
--     "googleMapsUrl": "https://maps.app.goo.gl/xxxx",
--     "isMarketplaceVisible": true,
--     "operatingHours": "Mon-Sat 08:00-18:00"
--   }
--
--   • Saved via:  saveAllData({ stores:[...] })  ->  save_state (changedKeys:['stores'])
--   • Loaded via: get_state  ->  state.stores
--
-- A MarketplaceProduct record gains:
--   {
--     ...,
--     "storeIds": [3, 5]   // physical store ids where the item is available
--                          // [] or absent = fall back to company (Main HQ) location
--   }
--   • Saved via:  saveMarketplaceProduct / onSaveProduct
--   • Loaded via: get_state  ->  state.marketplaceProducts
--
-- Public map resolution (frontend, StoreMapCard):
--   assigned = product.storeIds mapped to company's stores that have valid lat/lng
--   if (assigned.length === 0) -> render a single 'Main HQ' pin using company.latitude/longitude
--   else                       -> render one pin per assigned store
-- ============================================================================
