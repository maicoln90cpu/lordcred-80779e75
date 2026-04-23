
INSERT INTO seller_pix_v2 (seller_id, pix_key, pix_type)
SELECT seller_id, pix_key, pix_type FROM seller_pix
ON CONFLICT (seller_id) DO NOTHING;

INSERT INTO commission_rates_clt_v2 (effective_date, bank, table_key, term_min, term_max, has_insurance, rate, obs)
SELECT effective_date, bank, table_key, term_min, term_max, has_insurance, rate, obs FROM commission_rates_clt
WHERE NOT EXISTS (SELECT 1 FROM commission_rates_clt_v2);

INSERT INTO commission_settings_v2 (week_start_day, bonus_threshold, bonus_rate, bonus_mode, bonus_fixed_value, monthly_goal_type, monthly_goal_value, payment_day)
SELECT week_start_day, bonus_threshold, bonus_rate, bonus_mode, bonus_fixed_value, monthly_goal_type, monthly_goal_value, payment_day
FROM commission_settings
WHERE NOT EXISTS (SELECT 1 FROM commission_settings_v2)
LIMIT 1;

INSERT INTO commission_bonus_tiers_v2 (min_contracts, bonus_value)
SELECT min_contracts, bonus_value FROM commission_bonus_tiers
WHERE NOT EXISTS (SELECT 1 FROM commission_bonus_tiers_v2);

INSERT INTO commission_annual_rewards_v2 (min_contracts, reward_description, sort_order)
SELECT min_contracts, reward_description, sort_order FROM commission_annual_rewards
WHERE NOT EXISTS (SELECT 1 FROM commission_annual_rewards_v2);
