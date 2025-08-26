const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'database', 'schedule.db');

console.log('开始数据库迁移...');

// 连接数据库
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接数据库失败:', err.message);
        process.exit(1);
    } else {
        console.log('成功连接到SQLite数据库');
    }
});

// 迁移函数
async function migrateDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            console.log('开始检查数据库表结构...');
            
            // 先检查schedules表
            db.all("PRAGMA table_info(schedules)", (err, scheduleColumns) => {
                if (err) {
                    console.error('检查schedules表结构失败:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('当前schedules表结构:', scheduleColumns.map(col => col.name).join(', '));
                
                // 再检查teachers表
                db.all("PRAGMA table_info(teachers)", (err, teacherColumns) => {
                    if (err) {
                        console.error('检查teachers表结构失败:', err.message);
                        reject(err);
                        return;
                    }
                    
                    console.log('当前teachers表结构:', teacherColumns.map(col => col.name).join(', '));
                    
                    const migrations = [];
                    
                    // 检查schedules表需要的列
                    if (!scheduleColumns.some(col => col.name === 'is_archived')) {
                        migrations.push("ALTER TABLE schedules ADD COLUMN is_archived BOOLEAN DEFAULT FALSE");
                    }
                    if (!scheduleColumns.some(col => col.name === 'archived_at')) {
                        migrations.push("ALTER TABLE schedules ADD COLUMN archived_at DATETIME");
                    }
                    if (!scheduleColumns.some(col => col.name === 'archived_by')) {
                        migrations.push("ALTER TABLE schedules ADD COLUMN archived_by INTEGER");
                    }
                    if (!scheduleColumns.some(col => col.name === 'notes')) {
                        migrations.push("ALTER TABLE schedules ADD COLUMN notes TEXT");
                    }
                    
                    // 检查teachers表需要的列
                    if (!teacherColumns.some(col => col.name === 'subject')) {
                        migrations.push("ALTER TABLE teachers ADD COLUMN subject VARCHAR(50)");
                    }
                    
                    if (migrations.length === 0) {
                        console.log('数据库已是最新版本，无需迁移');
                        resolve();
                        return;
                    }
                    
                    console.log(`需要执行 ${migrations.length} 个迁移...`);
                    
                    // 执行迁移
                    let completed = 0;
                    migrations.forEach((migration, index) => {
                        console.log(`执行迁移 ${index + 1}/${migrations.length}: ${migration}`);
                        
                        db.run(migration, (err) => {
                            if (err) {
                                console.error(`迁移失败: ${migration}`, err.message);
                                reject(err);
                                return;
                            }
                            
                            completed++;
                            console.log(`迁移 ${index + 1} 完成`);
                            
                            if (completed === migrations.length) {
                                console.log('所有迁移完成！');
                                resolve();
                            }
                        });
                    });
                });
            });
        });
    });
}

// 执行迁移
migrateDatabase()
    .then(() => {
        console.log('数据库迁移成功！');
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接失败:', err.message);
            } else {
                console.log('数据库连接已关闭');
            }
            process.exit(0);
        });
    })
    .catch((error) => {
        console.error('数据库迁移失败:', error);
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接失败:', err.message);
            }
            process.exit(1);
        });
    }); 