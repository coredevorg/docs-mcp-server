-- Migration: Add source_link column to pages table
-- This migration adds a source_link field to store the original URL from front-matter metadata,
-- allowing bidirectional linking between the indexed content and the source system.

-- 1. Add source_link column to pages table
ALTER TABLE pages ADD COLUMN source_link TEXT;

-- 2. Add index for efficient querying by source_link
CREATE INDEX IF NOT EXISTS idx_pages_source_link ON pages(source_link);
