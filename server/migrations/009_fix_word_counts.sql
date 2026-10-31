-- 词书数量改为去重后的实际单词数
-- 旧版 seed 用源文件行数写入 word_count，遇到重复词条会偏大，导致进度永远到不了 100%
UPDATE word_books
SET word_count = (SELECT COUNT(*) FROM words WHERE words.book_id = word_books.id);
