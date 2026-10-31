-- 每日学习/复习结束后是否进行拼写测试
ALTER TABLE user_settings ADD COLUMN spelling_enabled INTEGER NOT NULL DEFAULT 0;
