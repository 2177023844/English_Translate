-- 每组学习单词数
ALTER TABLE user_settings ADD COLUMN group_size INTEGER NOT NULL DEFAULT 10;
