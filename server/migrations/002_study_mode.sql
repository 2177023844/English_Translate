-- 学习模式设置：zh2en（中→英选择）/ en2zh（英→中选择）
ALTER TABLE user_settings ADD COLUMN study_mode TEXT NOT NULL DEFAULT 'zh2en';
