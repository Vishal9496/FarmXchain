-- ============================================================================
-- P0-7 : find accounts that will hit the forced-reset path
-- Run-time diagnostic only. No schema change, no data change.
-- A BCrypt hash is always exactly 60 characters and starts with $2a$/$2b$/$2y$.
-- ============================================================================

SELECT id, email, role,
       CHAR_LENGTH(password) AS password_length,
       LEFT(password, 4)     AS prefix,
       CASE
           WHEN password REGEXP '^\\$2[aby]\\$[0-9]{2}\\$.{53}$' THEN 'BCrypt (OK)'
           ELSE 'LEGACY - will be forced to reset on next login attempt'
       END AS status
FROM users
ORDER BY status DESC, id;

-- Count only:
-- SELECT
--   SUM(password REGEXP '^\\$2[aby]\\$[0-9]{2}\\$.{53}$') AS bcrypt_accounts,
--   SUM(NOT password REGEXP '^\\$2[aby]\\$[0-9]{2}\\$.{53}$') AS legacy_accounts
-- FROM users;
