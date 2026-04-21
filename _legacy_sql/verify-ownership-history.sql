-- Quick Verification Script for Ownership History
-- Run this in Supabase SQL Editor to check if ownership history exists

-- 1. Check if the column exists
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'properties' 
  AND column_name = 'ownership_history';

-- 2. Check how many properties have ownership history
SELECT 
  COUNT(*) as total_properties,
  COUNT(*) FILTER (WHERE ownership_history IS NOT NULL) as with_history_column,
  COUNT(*) FILTER (
    WHERE ownership_history IS NOT NULL 
    AND jsonb_array_length(ownership_history) > 0
  ) as with_history_data,
  COUNT(*) FILTER (
    WHERE ownership_history IS NOT NULL 
    AND jsonb_array_length(ownership_history) > 0
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(ownership_history) AS elem
      WHERE elem->>'owner_name' IS NOT NULL
    )
  ) as with_valid_history
FROM properties;

-- 3. Show sample ownership history for first property
SELECT 
  id,
  title,
  ownership_history,
  jsonb_array_length(COALESCE(ownership_history, '[]'::jsonb)) as history_count
FROM properties
LIMIT 3;

-- 4. Show detailed ownership history for a specific property
SELECT 
  title,
  jsonb_pretty(ownership_history) as ownership_history_formatted
FROM properties
WHERE ownership_history IS NOT NULL 
  AND jsonb_array_length(ownership_history) > 0
LIMIT 1;







