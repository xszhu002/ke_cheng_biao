const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '../database/schedule.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
        return;
    }
    console.log('成功连接到SQLite数据库');
});

// 数据库表创建语句
const createTables = [
    // 教师表
    `CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100),
        phone VARCHAR(20),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 学期配置表
    `CREATE TABLE IF NOT EXISTS semester_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        semester_name VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_current BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 课程表表
    `CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        semester_id INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id),
        FOREIGN KEY (semester_id) REFERENCES semester_config(id)
    )`,

    // 课程安排表
    `CREATE TABLE IF NOT EXISTS course_arrangements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL,
        weekday INTEGER, -- 1-5 (周一到周五)，特需托管为NULL
        time_slot INTEGER NOT NULL, -- 1-9时间段
        course_name VARCHAR(100) NOT NULL,
        classroom VARCHAR(50),
        course_type VARCHAR(20) DEFAULT 'regular', -- 'regular' 或 'special_care'
        specific_date DATE, -- 仅特需托管使用
        notes TEXT,
        is_original BOOLEAN DEFAULT FALSE, -- 是否为原始课程表（学期初录入的基准）
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    )`,

    // 操作历史表
    `CREATE TABLE IF NOT EXISTS operation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL,
        operation_type VARCHAR(20) NOT NULL, -- 'move', 'add', 'delete', 'update'
        old_data TEXT, -- JSON格式的旧数据
        new_data TEXT, -- JSON格式的新数据
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    )`
];

// 初始化数据
const initData = [
    // 插入测试教师
    `INSERT OR IGNORE INTO teachers (name, email) VALUES 
        ('张老师', 'zhang@school.com'),
        ('李老师', 'li@school.com'),
        ('王老师', 'wang@school.com')`,

    // 插入学期配置
    `INSERT OR IGNORE INTO semester_config (semester_name, start_date, end_date, is_current) VALUES 
        ('2024学年第一学期', '2024-09-01', '2025-01-20', TRUE)`,

    // 插入默认课程表
    `INSERT OR IGNORE INTO schedules (teacher_id, name, semester_id) VALUES 
        (1, '张老师课程表', 1),
        (2, '李老师课程表', 1),
        (3, '王老师课程表', 1)`,

    // 插入示例课程（张老师）
    `INSERT OR IGNORE INTO course_arrangements (schedule_id, weekday, time_slot, course_name, classroom, course_type) VALUES 
        (1, 1, 3, '信息科技', '505', 'regular'),
        (1, 2, 3, '信息科技', '601', 'regular'),
        (1, 3, 3, '信息科技', '611', 'regular'),
        (1, 5, 3, '信息科技', '608', 'regular'),
        (1, 1, 5, '信息科技', '609', 'regular'),
        (1, 2, 6, '信息科技', '604', 'regular'),
        (1, 3, 6, '信息科技', '606', 'regular'),
        (1, 4, 6, '信息科技', '605', 'regular'),
        (1, 5, 6, '信息科技', '503', 'regular'),
        (1, 1, 7, '信息科技', '501', 'regular'),
        (1, 2, 7, '信息科技', '612', 'regular'),
        (1, 3, 7, '信息科技', '610', 'regular')`
];

// 执行数据库初始化
async function initDatabase() {
    try {
        // 创建表结构
        for (const sql of createTables) {
            await new Promise((resolve, reject) => {
                db.run(sql, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        console.log('数据库表创建完成');

        // 插入初始数据
        for (const sql of initData) {
            await new Promise((resolve, reject) => {
                db.run(sql, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        console.log('初始数据插入完成');

        console.log('数据库初始化成功！');
    } catch (error) {
        console.error('数据库初始化失败:', error.message);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接失败:', err.message);
            } else {
                console.log('数据库连接已关闭');
            }
        });
    }
}

// 执行初始化
initDatabase(); 