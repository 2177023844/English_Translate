-- 每天学习几组单词（每日学习总量 = 组数 × 每组数量）
ALTER TABLE user_settings ADD COLUMN daily_groups INTEGER NOT NULL DEFAULT 2;
