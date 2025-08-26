const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'database', 'schedule.db');

console.log('开始数据库清理...');

// 连接数据库
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接数据库失败:', err.message);
        process.exit(1);
    } else {
        console.log('成功连接到SQLite数据库');
    }
});

// 清理函数
async function cleanupDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            console.log('开始清理重复数据...');
            
            // 开始事务
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('开始事务失败:', err.message);
                    reject(err);
                    return;
                }
                
                // 1. 清理重复的学期数据
                console.log('清理学期表重复数据...');
                db.run(`
                    DELETE FROM semester_config 
                    WHERE id NOT IN (
                        SELECT MIN(id) 
                        FROM semester_config 
                        GROUP BY semester_name, start_date, end_date
                    )
                `, (err) => {
                    if (err) {
                        console.error('清理学期表失败:', err.message);
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                    console.log(`清理了 ${this.changes || 0} 个重复学期记录`);
                    
                    // 2. 清理重复的课程表数据
                    console.log('清理课程表重复数据...');
                    db.run(`
                        DELETE FROM schedules 
                        WHERE id NOT IN (
                            SELECT MIN(id) 
                            FROM schedules 
                            GROUP BY teacher_id, name, semester_id
                        )
                    `, (err) => {
                        if (err) {
                            console.error('清理课程表失败:', err.message);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        console.log(`清理了 ${this.changes} 个重复课程表记录`);
                        
                        // 3. 清理重复的教师数据
                        console.log('清理教师表重复数据...');
                        db.run(`
                            DELETE FROM teachers 
                            WHERE id NOT IN (
                                SELECT MIN(id) 
                                FROM teachers 
                                GROUP BY name, email
                            )
                        `, (err) => {
                            if (err) {
                                console.error('清理教师表失败:', err.message);
                                db.run('ROLLBACK');
                                reject(err);
                                return;
                            }
                            console.log(`清理了 ${this.changes} 个重复教师记录`);
                            
                            // 4. 清理重复的课程安排数据
                            console.log('清理课程安排表重复数据...');
                            db.run(`
                                DELETE FROM course_arrangements 
                                WHERE id NOT IN (
                                    SELECT MIN(id) 
                                    FROM course_arrangements 
                                    GROUP BY schedule_id, weekday, time_slot, course_name, classroom, course_type, specific_date, is_original
                                )
                            `, (err) => {
                                if (err) {
                                    console.error('清理课程安排表失败:', err.message);
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }
                                console.log(`清理了 ${this.changes} 个重复课程安排记录`);
                                
                                // 5. 提交事务
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        console.error('提交事务失败:', err.message);
                                        reject(err);
                                    } else {
                                        console.log('数据清理完成！');
                                        resolve();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// 显示清理前的数据统计
function showDataStats() {
    return new Promise((resolve, reject) => {
        console.log('\n=== 清理前数据统计 ===');
        
        const queries = [
            { name: '学期', table: 'semester_config' },
            { name: '教师', table: 'teachers' },
            { name: '课程表', table: 'schedules' },
            { name: '课程安排', table: 'course_arrangements' }
        ];
        
        let completed = 0;
        
        queries.forEach(query => {
            db.get(`SELECT COUNT(*) as count FROM ${query.table}`, (err, row) => {
                if (err) {
                    console.error(`查询${query.name}表失败:`, err.message);
                } else {
                    console.log(`${query.name}: ${row.count} 条记录`);
                }
                
                completed++;
                if (completed === queries.length) {
                    console.log('===================\n');
                    resolve();
                }
            });
        });
    });
}

// 显示清理后的数据统计
function showDataStatsAfter() {
    return new Promise((resolve, reject) => {
        console.log('\n=== 清理后数据统计 ===');
        
        const queries = [
            { name: '学期', table: 'semester_config' },
            { name: '教师', table: 'teachers' },
            { name: '课程表', table: 'schedules' },
            { name: '课程安排', table: 'course_arrangements' }
        ];
        
        let completed = 0;
        
        queries.forEach(query => {
            db.get(`SELECT COUNT(*) as count FROM ${query.table}`, (err, row) => {
                if (err) {
                    console.error(`查询${query.name}表失败:`, err.message);
                } else {
                    console.log(`${query.name}: ${row.count} 条记录`);
                }
                
                completed++;
                if (completed === queries.length) {
                    console.log('===================\n');
                    resolve();
                }
            });
        });
    });
}

// 执行清理
async function main() {
    try {
        await showDataStats();
        await cleanupDatabase();
        await showDataStatsAfter();
        
        console.log('数据库清理成功完成！');
    } catch (error) {
        console.error('数据库清理失败:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接失败:', err.message);
            } else {
                console.log('数据库连接已关闭');
            }
            process.exit(0);
        });
    }
}

main(); 