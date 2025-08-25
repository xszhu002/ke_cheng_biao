const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// 数据库连接
const dbPath = path.join(__dirname, 'database/schedule.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('数据库连接成功');
    }
});

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 调试中间件 - 放在body parser之后
app.use((req, res, next) => {
    if ((req.method === 'PUT' || req.method === 'POST') && req.url.includes('/api/courses')) {
        console.log(`收到${req.method}请求:`, {
            url: req.url,
            contentType: req.get('Content-Type'),
            body: req.body,
            rawBody: JSON.stringify(req.body)
        });
    }
    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 将数据库实例添加到请求对象中
app.use((req, res, next) => {
    req.db = db;
    next();
});

// API路由
// 教师管理
app.get('/api/teachers', (req, res) => {
    const sql = 'SELECT * FROM teachers ORDER BY name';
    req.db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('获取教师列表失败:', err.message);
            res.status(500).json({ error: '获取教师列表失败' });
        } else {
            res.json(rows);
        }
    });
});

app.post('/api/teachers', (req, res) => {
    const { name, email, phone } = req.body;
    const sql = 'INSERT INTO teachers (name, email, phone) VALUES (?, ?, ?)';
    
    req.db.run(sql, [name, email, phone], function(err) {
        if (err) {
            console.error('创建教师失败:', err.message);
            res.status(500).json({ error: '创建教师失败' });
        } else {
            res.json({ 
                id: this.lastID, 
                name, 
                email, 
                phone, 
                message: '教师创建成功' 
            });
        }
    });
});

// 课程表管理
app.get('/api/schedules/teacher/:teacherId', (req, res) => {
    const teacherId = req.params.teacherId;
    const sql = `
        SELECT s.*, t.name as teacher_name 
        FROM schedules s 
        JOIN teachers t ON s.teacher_id = t.id 
        WHERE s.teacher_id = ? AND s.is_active = 1
    `;
    
    req.db.get(sql, [teacherId], (err, row) => {
        if (err) {
            console.error('获取课程表失败:', err.message);
            res.status(500).json({ error: '获取课程表失败' });
        } else {
            res.json(row || {});
        }
    });
});

app.get('/api/schedules/:scheduleId/week/:week', (req, res) => {
    const { scheduleId, week } = req.params;
    
    // 获取常规课程（前8个时间段，只显示非原始课程）
    const regularSql = `
        SELECT * FROM course_arrangements 
        WHERE schedule_id = ? AND course_type = 'regular' AND weekday IS NOT NULL AND is_original = FALSE
        ORDER BY weekday, time_slot
    `;
    
    req.db.all(regularSql, [scheduleId], (err, regularCourses) => {
        if (err) {
            console.error('获取常规课程失败:', err.message);
            res.status(500).json({ error: '获取课程失败' });
            return;
        }
        
        // 获取学期开始日期来计算该周的日期范围
        const semesterSql = 'SELECT start_date FROM semester_config WHERE is_current = 1';
        req.db.get(semesterSql, [], (err, semester) => {
            if (err) {
                console.error('获取学期信息失败:', err.message);
                res.status(500).json({ error: '获取学期信息失败' });
                return;
            }
            
            if (!semester) {
                res.status(404).json({ error: '未找到当前学期' });
                return;
            }
            
            // 计算该周的日期范围
            const startDate = new Date(semester.start_date);
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() + (week - 1) * 7);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 4); // 周五
            
            // 获取该周的特需托管
            const specialCareSql = `
                SELECT * FROM course_arrangements 
                WHERE schedule_id = ? AND course_type = 'special_care' 
                AND specific_date BETWEEN ? AND ?
                ORDER BY specific_date
            `;
            
            const weekStartStr = weekStart.toISOString().split('T')[0];
            const weekEndStr = weekEnd.toISOString().split('T')[0];
            
            req.db.all(specialCareSql, [scheduleId, weekStartStr, weekEndStr], (err, specialCare) => {
                if (err) {
                    console.error('获取特需托管失败:', err.message);
                    res.status(500).json({ error: '获取特需托管失败' });
                    return;
                }
                
                res.json({
                    regularCourses,
                    specialCare,
                    weekStart: weekStartStr,
                    weekEnd: weekEndStr
                });
            });
        });
    });
});

// 课程管理
app.post('/api/courses', (req, res) => {
    const { scheduleId, weekday, timeSlot, courseName, classroom, teacher, notes } = req.body;
    
    console.log('收到创建课程请求:', { scheduleId, weekday, timeSlot, courseName, classroom, teacher, notes });
    
    // 验证参数
    if (!scheduleId || !weekday || !timeSlot || !courseName) {
        res.status(400).json({ error: '缺少必要参数' });
        return;
    }
    
    const sql = `
        INSERT INTO course_arrangements 
        (schedule_id, weekday, time_slot, course_name, classroom, notes, course_type)
        VALUES (?, ?, ?, ?, ?, ?, 'regular')
    `;
    
    req.db.run(sql, [scheduleId, weekday, timeSlot, courseName, classroom || null, notes || null], function(err) {
        if (err) {
            console.error('创建课程失败:', err.message);
            res.status(500).json({ error: '创建课程失败: ' + err.message });
        } else {
            const courseId = this.lastID;
            const newCourse = {
                id: courseId,
                schedule_id: scheduleId,
                weekday: weekday,
                time_slot: timeSlot,
                course_name: courseName,
                classroom: classroom || null,
                notes: notes || null,
                course_type: 'regular'
            };
            
            // 记录操作历史
            const historySql = `
                INSERT INTO operation_history (schedule_id, operation_type, old_data, new_data)
                VALUES (?, 'add', '{}', ?)
            `;
            
            req.db.run(historySql, [scheduleId, JSON.stringify(newCourse)], (historyErr) => {
                if (historyErr) {
                    console.warn('记录添加课程历史失败:', historyErr.message);
                }
            });
            
            res.json({ 
                id: courseId, 
                message: '课程创建成功' 
            });
        }
    });
});

app.put('/api/courses/:id/move', (req, res) => {
    const courseId = req.params.id;
    const { weekday, timeSlot, scheduleId } = req.body;
    
    console.log('收到移动课程请求:', { courseId, weekday, timeSlot, scheduleId });
    
    // 验证参数
    if (weekday === undefined || timeSlot === undefined || scheduleId === undefined) {
        console.log('参数验证失败:', { weekday, timeSlot, scheduleId });
        res.status(400).json({ error: '缺少必要参数' });
        return;
    }
    
    // 记录操作历史
    const getOldDataSql = 'SELECT * FROM course_arrangements WHERE id = ?';
    req.db.get(getOldDataSql, [courseId], (err, oldData) => {
        if (err) {
            console.error('获取原始数据失败:', err.message);
            res.status(500).json({ error: '移动课程失败' });
            return;
        }
        
        if (!oldData) {
            res.status(404).json({ error: '课程不存在' });
            return;
        }
        
        // 检查是否为原始课程
        if (oldData.is_original) {
            // 如果是原始课程，创建一个新的临时课程，而不修改原始课程
            const insertSql = `
                INSERT INTO course_arrangements 
                (schedule_id, weekday, time_slot, course_name, classroom, course_type, specific_date, notes, is_original)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)
            `;
            
            req.db.run(insertSql, [
                oldData.schedule_id,
                weekday,
                timeSlot,
                oldData.course_name,
                oldData.classroom,
                oldData.course_type,
                oldData.specific_date,
                oldData.notes
            ], function(insertErr) {
                if (insertErr) {
                    console.error('创建临时课程失败:', insertErr.message);
                    res.status(500).json({ error: '移动课程失败: ' + insertErr.message });
                    return;
                }
                
                res.json({ 
                    message: '课程移动成功',
                    newCourseId: this.lastID,
                    originalKept: true
                });
            });
        } else {
            // 如果是临时课程，直接更新位置
            const updateSql = `
                UPDATE course_arrangements 
                SET weekday = ?, time_slot = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            req.db.run(updateSql, [weekday, timeSlot, courseId], function(err) {
                if (err) {
                    console.error('更新课程位置失败:', err.message);
                    res.status(500).json({ error: '移动课程失败: ' + err.message });
                    return;
                }
                
                res.json({ message: '课程移动成功', changes: this.changes });
            });
        }
    });
});

app.delete('/api/courses/:id', (req, res) => {
    const courseId = req.params.id;
    
    const sql = 'DELETE FROM course_arrangements WHERE id = ? AND course_type = "regular"';
    
    req.db.run(sql, [courseId], function(err) {
        if (err) {
            console.error('删除课程失败:', err.message);
            res.status(500).json({ error: '删除课程失败: ' + err.message });
        } else {
            res.json({ message: '课程删除成功', changes: this.changes });
        }
    });
});

// 特需托管管理
app.post('/api/special-care', (req, res) => {
    const { scheduleId, specificDate, courseName, classroom, notes } = req.body;
    
    // 验证参数
    if (!scheduleId || !specificDate || !courseName) {
        res.status(400).json({ error: '缺少必要参数' });
        return;
    }
    
    const sql = `
        INSERT INTO course_arrangements 
        (schedule_id, time_slot, course_name, classroom, course_type, specific_date, notes)
        VALUES (?, 9, ?, ?, 'special_care', ?, ?)
    `;
    
    req.db.run(sql, [scheduleId, courseName, classroom || null, specificDate, notes || null], function(err) {
        if (err) {
            console.error('添加特需托管失败:', err.message);
            res.status(500).json({ error: '添加特需托管失败: ' + err.message });
        } else {
            res.json({ 
                id: this.lastID, 
                message: '特需托管添加成功' 
            });
        }
    });
});

app.get('/api/special-care/schedule/:scheduleId', (req, res) => {
    const scheduleId = req.params.scheduleId;
    const sql = `
        SELECT * FROM course_arrangements 
        WHERE schedule_id = ? AND course_type = 'special_care'
        ORDER BY specific_date
    `;
    
    req.db.all(sql, [scheduleId], (err, rows) => {
        if (err) {
            console.error('获取特需托管列表失败:', err.message);
            res.status(500).json({ error: '获取特需托管列表失败' });
        } else {
            res.json(rows);
        }
    });
});

app.put('/api/special-care/:id', (req, res) => {
    const id = req.params.id;
    const { weekday, timeSlot, specificDate, courseName, classroom, notes } = req.body;
    
    // 验证参数
    if (!specificDate || !courseName) {
        res.status(400).json({ error: '缺少必要参数' });
        return;
    }
    
    const sql = `
        UPDATE course_arrangements 
        SET specific_date = ?, course_name = ?, classroom = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND course_type = 'special_care'
    `;
    
    req.db.run(sql, [specificDate, courseName, classroom || null, notes || null, id], function(err) {
        if (err) {
            console.error('更新特需托管失败:', err.message);
            res.status(500).json({ error: '更新特需托管失败: ' + err.message });
        } else {
            res.json({ message: '特需托管更新成功', changes: this.changes });
        }
    });
});

app.delete('/api/special-care/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM course_arrangements WHERE id = ? AND course_type = "special_care"';
    
    req.db.run(sql, [id], function(err) {
        if (err) {
            console.error('删除特需托管失败:', err.message);
            res.status(500).json({ error: '删除特需托管失败' });
        } else {
            res.json({ message: '特需托管删除成功', changes: this.changes });
        }
    });
});

// 保存为原始课程表
app.post('/api/schedules/:id/save-original', (req, res) => {
    const scheduleId = req.params.id;
    
    req.db.serialize(() => {
        // 开始事务
        req.db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
                console.error('开始事务失败:', err.message);
                res.status(500).json({ error: '保存失败: ' + err.message });
                return;
            }
            
            // 1. 清除当前的原始课程表标记
            req.db.run(
                'UPDATE course_arrangements SET is_original = FALSE WHERE schedule_id = ?',
                [scheduleId],
                (clearErr) => {
                    if (clearErr) {
                        req.db.run('ROLLBACK');
                        console.error('清除原始标记失败:', clearErr.message);
                        res.status(500).json({ error: '保存失败: ' + clearErr.message });
                        return;
                    }
                    
                    // 2. 将当前课程表标记为原始
                    req.db.run(
                        'UPDATE course_arrangements SET is_original = TRUE WHERE schedule_id = ?',
                        [scheduleId],
                        (markErr) => {
                            if (markErr) {
                                req.db.run('ROLLBACK');
                                console.error('标记原始课程表失败:', markErr.message);
                                res.status(500).json({ error: '保存失败: ' + markErr.message });
                                return;
                            }
                            
                            // 3. 提交事务
                            req.db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    console.error('提交事务失败:', commitErr.message);
                                    res.status(500).json({ error: '保存失败: ' + commitErr.message });
                                } else {
                                    res.json({ message: '原始课程表保存成功' });
                                }
                            });
                        }
                    );
                }
            );
        });
    });
});

// 复位到原始课程表
app.post('/api/schedules/:id/reset', (req, res) => {
    const scheduleId = req.params.id;
    
    req.db.serialize(() => {
        // 1. 检查是否有原始课程表
        req.db.all(
            'SELECT * FROM course_arrangements WHERE schedule_id = ? AND is_original = TRUE',
            [scheduleId],
            (err, originalCourses) => {
                if (err) {
                    console.error('查询原始课程表失败:', err.message);
                    res.status(500).json({ error: '复位失败: ' + err.message });
                    return;
                }
                
                if (!originalCourses || originalCourses.length === 0) {
                    res.status(400).json({ error: '没有找到原始课程表，请先保存原始课程表' });
                    return;
                }
                
                // 开始事务
                req.db.run('BEGIN TRANSACTION', (beginErr) => {
                    if (beginErr) {
                        console.error('开始事务失败:', beginErr.message);
                        res.status(500).json({ error: '复位失败: ' + beginErr.message });
                        return;
                    }
                    
                    // 2. 删除该课程表的所有课程（包括原始和临时）
                    req.db.run(
                        'DELETE FROM course_arrangements WHERE schedule_id = ?',
                        [scheduleId],
                        (deleteErr) => {
                            if (deleteErr) {
                                req.db.run('ROLLBACK');
                                console.error('删除课程失败:', deleteErr.message);
                                res.status(500).json({ error: '复位失败: ' + deleteErr.message });
                                return;
                            }
                            
                            // 3. 重新插入原始课程（保持原始标记）
                            const originalPromises = originalCourses.map(course => {
                                return new Promise((resolve, reject) => {
                                    const insertSql = `
                                        INSERT INTO course_arrangements 
                                        (schedule_id, weekday, time_slot, course_name, classroom, course_type, specific_date, notes, is_original, created_at, updated_at)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                    `;
                                    req.db.run(insertSql, [
                                        course.schedule_id,
                                        course.weekday,
                                        course.time_slot,
                                        course.course_name,
                                        course.classroom,
                                        course.course_type,
                                        course.specific_date,
                                        course.notes
                                    ], function(insertErr) {
                                        if (insertErr) {
                                            reject(insertErr);
                                        } else {
                                            resolve();
                                        }
                                    });
                                });
                            });
                            
                            // 4. 复制原始课程为当前可操作课程
                            const currentPromises = originalCourses.map(course => {
                                return new Promise((resolve, reject) => {
                                    const insertSql = `
                                        INSERT INTO course_arrangements 
                                        (schedule_id, weekday, time_slot, course_name, classroom, course_type, specific_date, notes, is_original, created_at, updated_at)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                    `;
                                    req.db.run(insertSql, [
                                        course.schedule_id,
                                        course.weekday,
                                        course.time_slot,
                                        course.course_name,
                                        course.classroom,
                                        course.course_type,
                                        course.specific_date,
                                        course.notes
                                    ], function(insertErr) {
                                        if (insertErr) {
                                            reject(insertErr);
                                        } else {
                                            resolve();
                                        }
                                    });
                                });
                            });
                            
                            Promise.all([...originalPromises, ...currentPromises])
                                .then(() => {
                                    // 5. 提交事务
                                    req.db.run('COMMIT', (commitErr) => {
                                        if (commitErr) {
                                            console.error('提交事务失败:', commitErr.message);
                                            res.status(500).json({ error: '复位失败: ' + commitErr.message });
                                        } else {
                                            res.json({ message: '课程表已复位到原始状态' });
                                        }
                                    });
                                })
                                .catch((insertErr) => {
                                    req.db.run('ROLLBACK');
                                    console.error('恢复原始课程失败:', insertErr.message);
                                    res.status(500).json({ error: '复位失败: ' + insertErr.message });
                                });
                        }
                    );
                });
            }
        );
    });
});

// 学期管理
app.get('/api/calendar/semester/current', (req, res) => {
    const sql = 'SELECT * FROM semester_config WHERE is_current = 1';
    req.db.get(sql, [], (err, row) => {
        if (err) {
            console.error('获取当前学期失败:', err.message);
            res.status(500).json({ error: '获取当前学期失败' });
        } else {
            res.json(row || {});
        }
    });
});

// 根路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close((err) => {
        if (err) {
            console.error('关闭数据库连接失败:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
}); 