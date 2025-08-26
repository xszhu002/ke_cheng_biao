const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

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

// 会话配置
app.use(session({
    secret: 'schedule-system-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // 在HTTPS中设为true
        maxAge: 3600000 // 1小时
    }
}));

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

// 管理员认证中间件
function requireAuth(req, res, next) {
    if (req.session && req.session.adminId) {
        return next();
    } else {
        return res.status(401).json({ error: '需要管理员登录' });
    }
}

// 工具函数：生成密码哈希
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

// 工具函数：验证密码
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// 将数据库实例添加到请求对象中
app.use((req, res, next) => {
    req.db = db;
    next();
});

// API路由
// 教师管理
app.get('/api/teachers', (req, res) => {
    const sql = `
        SELECT DISTINCT t.* 
        FROM teachers t 
        INNER JOIN schedules s ON t.id = s.teacher_id 
        WHERE s.is_active = 1 AND (s.is_archived IS NULL OR s.is_archived = FALSE)
        ORDER BY t.name
    `;
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
        WHERE s.teacher_id = ? AND s.is_active = 1 AND (s.is_archived IS NULL OR s.is_archived = FALSE)
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
            
            // 获取该周的特需托管（只获取临时课程）
            const specialCareSql = `
                SELECT * FROM course_arrangements 
                WHERE schedule_id = ? AND course_type = 'special_care' AND is_original = FALSE
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
    const { scheduleId, weekday, timeSlot, courseName, classroom, teacher, notes, isEditMode } = req.body;
    
    console.log('收到创建课程请求:', { scheduleId, weekday, timeSlot, courseName, classroom, teacher, notes, isEditMode });
    
    // 验证参数
    if (!scheduleId || !weekday || !timeSlot || !courseName) {
        res.status(400).json({ error: '缺少必要参数' });
        return;
    }
    
    // 根据是否为编辑模式决定是否设为原始课程
    const isOriginal = isEditMode === true;
    
    const sql = `
        INSERT INTO course_arrangements 
        (schedule_id, weekday, time_slot, course_name, classroom, notes, course_type, is_original)
        VALUES (?, ?, ?, ?, ?, ?, 'regular', ?)
    `;
    
    req.db.run(sql, [scheduleId, weekday, timeSlot, courseName, classroom || null, notes || null, isOriginal], function(err) {
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
                course_type: 'regular',
                is_original: isOriginal
            };
            
            // 只有非编辑模式才记录操作历史
            if (!isEditMode) {
                const historySql = `
                    INSERT INTO operation_history (schedule_id, operation_type, old_data, new_data)
                    VALUES (?, 'add', '{}', ?)
                `;
                
                req.db.run(historySql, [scheduleId, JSON.stringify(newCourse)], (historyErr) => {
                    if (historyErr) {
                        console.warn('记录添加课程历史失败:', historyErr.message);
                    }
                });
            }
            
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
    
    // 删除课程（不限制course_type，可以删除原始课程）
    const sql = 'DELETE FROM course_arrangements WHERE id = ?';
    
    req.db.run(sql, [courseId], function(err) {
        if (err) {
            console.error('删除课程失败:', err.message);
            res.status(500).json({ error: '删除课程失败: ' + err.message });
        } else {
            console.log(`成功删除课程 ID: ${courseId}`);
            res.json({ message: '课程删除成功', changes: this.changes });
        }
    });
});

// 特需托管管理
app.post('/api/special-care', (req, res) => {
    const { scheduleId, specificDate, courseName, classroom, notes, isEditMode } = req.body;
    
    // 验证参数
    if (!scheduleId || !specificDate || !courseName) {
        res.status(400).json({ error: '缺少必要参数' });
        return;
    }
    
    // 根据是否为编辑模式决定是否设为原始课程
    const isOriginal = isEditMode === true;
    
    const sql = `
        INSERT INTO course_arrangements 
        (schedule_id, time_slot, course_name, classroom, course_type, specific_date, notes, is_original)
        VALUES (?, 9, ?, ?, 'special_care', ?, ?, ?)
    `;
    
    req.db.run(sql, [scheduleId, courseName, classroom || null, specificDate, notes || null, isOriginal], function(err) {
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
            res.status(500).json({ error: '删除特需托管失败: ' + err.message });
        } else {
            console.log(`成功删除特需托管 ID: ${id}`);
            res.json({ message: '特需托管删除成功', changes: this.changes });
        }
    });
});

// 保存为原始课程表
app.post('/api/schedules/:id/save-original', (req, res) => {
    const scheduleId = req.params.id;
    
    console.log(`开始保存原始课程表，scheduleId: ${scheduleId}`);
    
    req.db.serialize(() => {
        // 开始事务
        req.db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
                console.error('开始事务失败:', err.message);
                res.status(500).json({ error: '保存失败: ' + err.message });
                return;
            }
            
            // 1. 只获取编辑模式中显示的原始课程
            req.db.all(
                'SELECT * FROM course_arrangements WHERE schedule_id = ? AND is_original = TRUE',
                [scheduleId],
                (selectErr, originalCourses) => {
                    if (selectErr) {
                        req.db.run('ROLLBACK');
                        console.error('查询原始课程失败:', selectErr.message);
                        res.status(500).json({ error: '保存失败: ' + selectErr.message });
                        return;
                    }
                    
                    console.log(`找到 ${originalCourses.length} 个原始课程`);
                    
                    // 2. 删除所有现有课程
                    req.db.run(
                        'DELETE FROM course_arrangements WHERE schedule_id = ?',
                        [scheduleId],
                        function(deleteErr) {
                            if (deleteErr) {
                                req.db.run('ROLLBACK');
                                console.error('删除现有课程失败:', deleteErr.message);
                                res.status(500).json({ error: '保存失败: ' + deleteErr.message });
                                return;
                            }
                            
                            console.log(`删除了 ${this.changes} 个现有课程`);
                            
                            if (originalCourses.length === 0) {
                                // 没有课程需要保存
                                req.db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        console.error('提交事务失败:', commitErr.message);
                                        res.status(500).json({ error: '保存失败: ' + commitErr.message });
                                    } else {
                                        console.log('原始课程表保存成功（空课程表）');
                                        res.json({ message: '原始课程表保存成功' });
                                    }
                                });
                                return;
                            }
                            
                            // 3. 分离常规课程和特需托管
                            const regularCourses = originalCourses.filter(course => course.course_type !== 'special_care');
                            const specialCareCourses = originalCourses.filter(course => course.course_type === 'special_care');
                            
                            // 4. 重新插入原始课程（包括常规课程和特需托管）
                            const originalInsertPromises = originalCourses.map(course => {
                                return new Promise((resolve, reject) => {
                                    const insertSql = `
                                        INSERT INTO course_arrangements 
                                        (schedule_id, weekday, time_slot, course_name, classroom, course_type, specific_date, notes, is_original)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
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
                                            console.error('重新创建原始课程失败:', insertErr.message);
                                            reject(insertErr);
                                        } else {
                                            console.log(`重新创建原始课程: ${course.course_name}`);
                                            resolve();
                                        }
                                    });
                                });
                            });
                            
                            // 5. 为所有课程（包括常规课程和特需托管）创建临时副本
                            const tempInsertPromises = originalCourses.map(course => {
                                return new Promise((resolve, reject) => {
                                    const insertSql = `
                                        INSERT INTO course_arrangements 
                                        (schedule_id, weekday, time_slot, course_name, classroom, course_type, specific_date, notes, is_original)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)
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
                                            console.error('创建临时课程副本失败:', insertErr.message);
                                            reject(insertErr);
                                        } else {
                                            console.log(`创建临时课程副本: ${course.course_name}`);
                                            resolve();
                                        }
                                    });
                                });
                            });
                            
                            Promise.all([...originalInsertPromises, ...tempInsertPromises])
                                .then(() => {
                                    // 5. 提交事务
                                    req.db.run('COMMIT', (commitErr) => {
                                        if (commitErr) {
                                            console.error('提交事务失败:', commitErr.message);
                                            res.status(500).json({ error: '保存失败: ' + commitErr.message });
                                        } else {
                                            console.log('原始课程表保存成功');
                                            res.json({ message: '原始课程表保存成功' });
                                        }
                                    });
                                })
                                .catch((insertErr) => {
                                    req.db.run('ROLLBACK');
                                    console.error('插入新课程失败:', insertErr.message);
                                    res.status(500).json({ error: '保存失败: ' + insertErr.message });
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

// 获取原始课程表数据
app.get('/api/schedules/:scheduleId/original', (req, res) => {
    const scheduleId = req.params.scheduleId;
    
    // 获取原始课程（is_original = TRUE）
    const regularSql = `
        SELECT * FROM course_arrangements 
        WHERE schedule_id = ? AND course_type = 'regular' AND weekday IS NOT NULL AND is_original = TRUE
        ORDER BY weekday, time_slot
    `;
    
    req.db.all(regularSql, [scheduleId], (err, regularCourses) => {
        if (err) {
            console.error('获取原始课程失败:', err.message);
            res.status(500).json({ error: '获取原始课程失败' });
            return;
        }
        
        // 获取原始特需托管
        const specialCareSql = `
            SELECT * FROM course_arrangements 
            WHERE schedule_id = ? AND course_type = 'special_care' AND is_original = TRUE
            ORDER BY specific_date
        `;
        
        req.db.all(specialCareSql, [scheduleId], (err, specialCare) => {
            if (err) {
                console.error('获取原始特需托管失败:', err.message);
                res.status(500).json({ error: '获取原始特需托管失败' });
                return;
            }
            
            res.json({
                regularCourses: regularCourses || [],
                specialCare: specialCare || []
            });
        });
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

// ===========================================
// 管理员API
// ===========================================

// 教师管理API
// 获取所有教师
app.get('/api/admin/teachers', requireAuth, (req, res) => {
    console.log('获取教师列表请求');
    
    const sql = `SELECT 
        id, name, email, subject, phone, 
        created_at, updated_at 
        FROM teachers 
        ORDER BY name`;
    
    req.db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('获取教师列表失败:', err.message);
            res.status(500).json({ error: '获取教师列表失败' });
        } else {
            console.log(`获取到 ${rows.length} 个教师`);
            res.json(rows || []);
        }
    });
});

// 创建新教师
app.post('/api/admin/teachers', requireAuth, (req, res) => {
    const { name, email, subject, phone } = req.body;
    
    console.log('创建教师请求:', { name, email, subject, phone });
    
    // 验证必填字段
    if (!name || !email) {
        return res.status(400).json({ error: '姓名和邮箱为必填字段' });
    }
    
    const sql = `INSERT INTO teachers (name, email, subject, phone) VALUES (?, ?, ?, ?)`;
    
    req.db.run(sql, [name, email, subject || '', phone || ''], function(err) {
        if (err) {
            console.error('创建教师失败:', err.message);
            if (err.message.includes('UNIQUE constraint failed')) {
                res.status(400).json({ error: '邮箱已存在' });
            } else {
                res.status(500).json({ error: '创建教师失败' });
            }
        } else {
            console.log('教师创建成功，ID:', this.lastID);
            res.json({ 
                message: '教师创建成功', 
                teacherId: this.lastID 
            });
        }
    });
});

// 更新教师信息
app.put('/api/admin/teachers/:id', requireAuth, (req, res) => {
    const teacherId = req.params.id;
    const { name, email, subject, phone } = req.body;
    
    console.log('更新教师请求:', { teacherId, name, email, subject, phone });
    
    // 验证必填字段
    if (!name || !email) {
        return res.status(400).json({ error: '姓名和邮箱为必填字段' });
    }
    
    const sql = `UPDATE teachers 
                 SET name = ?, email = ?, subject = ?, phone = ?, 
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`;
    
    req.db.run(sql, [name, email, subject || '', phone || '', teacherId], function(err) {
        if (err) {
            console.error('更新教师失败:', err.message);
            if (err.message.includes('UNIQUE constraint failed')) {
                res.status(400).json({ error: '邮箱已存在' });
            } else {
                res.status(500).json({ error: '更新教师失败' });
            }
        } else if (this.changes === 0) {
            res.status(404).json({ error: '教师不存在' });
        } else {
            console.log('教师更新成功');
            res.json({ message: '教师更新成功' });
        }
    });
});

// 删除教师（带课表检查）
app.delete('/api/admin/teachers/:id', requireAuth, (req, res) => {
    const teacherId = req.params.id;
    
    console.log('删除教师请求:', { teacherId });
    
    // 首先检查该教师是否有关联的课表
    const checkSchedulesSql = `SELECT COUNT(*) as count FROM schedules WHERE teacher_id = ?`;
    
    req.db.get(checkSchedulesSql, [teacherId], (err, row) => {
        if (err) {
            console.error('检查教师课表失败:', err.message);
            return res.status(500).json({ error: '检查教师课表失败' });
        }
        
        const scheduleCount = row.count;
        console.log(`教师 ${teacherId} 有 ${scheduleCount} 个课表`);
        
        if (scheduleCount > 0) {
            return res.status(400).json({ 
                error: `无法删除教师，该教师还有 ${scheduleCount} 个关联的课表，请先删除相关课表后再删除教师账号`,
                scheduleCount: scheduleCount
            });
        }
        
        // 如果没有关联课表，则可以删除教师
        const deleteTeacherSql = `DELETE FROM teachers WHERE id = ?`;
        
        req.db.run(deleteTeacherSql, [teacherId], function(err) {
            if (err) {
                console.error('删除教师失败:', err.message);
                res.status(500).json({ error: '删除教师失败' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: '教师不存在' });
            } else {
                console.log('教师删除成功');
                res.json({ message: '教师删除成功' });
            }
        });
    });
});

// 获取教师的课表列表
app.get('/api/admin/teachers/:id/schedules', requireAuth, (req, res) => {
    const teacherId = req.params.id;
    
    console.log('获取教师课表列表请求:', { teacherId });
    
    const sql = `SELECT 
        s.id, s.name, s.semester_id, s.is_archived,
        sc.semester_name,
        COUNT(ca.id) as course_count
        FROM schedules s
        LEFT JOIN semester_config sc ON s.semester_id = sc.id
        LEFT JOIN course_arrangements ca ON s.id = ca.schedule_id AND ca.is_original = TRUE
        WHERE s.teacher_id = ?
        GROUP BY s.id, s.name, s.semester_id, s.is_archived, sc.semester_name
        ORDER BY sc.start_date DESC, s.name`;
    
    req.db.all(sql, [teacherId], (err, rows) => {
        if (err) {
            console.error('获取教师课表列表失败:', err.message);
            res.status(500).json({ error: '获取教师课表列表失败' });
        } else {
            console.log(`获取到教师 ${teacherId} 的 ${rows.length} 个课表`);
            res.json(rows || []);
        }
    });
});

// 检查是否存在管理员账号
app.get('/api/admin/check', (req, res) => {
    const sql = 'SELECT COUNT(*) as count FROM admins WHERE is_active = TRUE';
    req.db.get(sql, [], (err, row) => {
        if (err) {
            console.error('检查管理员账号失败:', err.message);
            res.status(500).json({ error: '检查管理员账号失败' });
        } else {
            res.json({ 
                hasAdmin: row.count > 0,
                isLoggedIn: !!req.session.adminId 
            });
        }
    });
});

// 创建首个管理员账号
app.post('/api/admin/setup', async (req, res) => {
    const { username, password, email, fullName } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6位' });
    }
    
    try {
        // 检查是否已有管理员
        const checkSql = 'SELECT COUNT(*) as count FROM admins WHERE is_active = TRUE';
        req.db.get(checkSql, [], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: '检查管理员账号失败' });
            }
            
            if (row.count > 0) {
                return res.status(400).json({ error: '管理员账号已存在' });
            }
            
            // 创建管理员账号
            const passwordHash = await hashPassword(password);
            const insertSql = `
                INSERT INTO admins (username, password_hash, email, full_name)
                VALUES (?, ?, ?, ?)
            `;
            
            req.db.run(insertSql, [username, passwordHash, email || null, fullName || null], function(err) {
                if (err) {
                    console.error('创建管理员失败:', err.message);
                    res.status(500).json({ error: '创建管理员失败' });
                } else {
                    res.json({ message: '管理员账号创建成功', adminId: this.lastID });
                }
            });
        });
    } catch (error) {
        console.error('创建管理员失败:', error);
        res.status(500).json({ error: '创建管理员失败' });
    }
});

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const sql = 'SELECT * FROM admins WHERE username = ? AND is_active = TRUE';
    req.db.get(sql, [username], async (err, admin) => {
        if (err) {
            console.error('登录查询失败:', err.message);
            return res.status(500).json({ error: '登录失败' });
        }
        
        if (!admin) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        try {
            const isValidPassword = await verifyPassword(password, admin.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: '用户名或密码错误' });
            }
            
            // 设置会话
            req.session.adminId = admin.id;
            req.session.username = admin.username;
            
            // 更新最后登录时间
            const updateSql = 'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
            req.db.run(updateSql, [admin.id]);
            
            res.json({
                message: '登录成功',
                admin: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    fullName: admin.full_name
                }
            });
            
        } catch (error) {
            console.error('密码验证失败:', error);
            res.status(500).json({ error: '登录失败' });
        }
    });
});

// 管理员退出登录
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('注销失败:', err);
            res.status(500).json({ error: '注销失败' });
        } else {
            res.json({ message: '已成功退出登录' });
        }
    });
});

// 获取当前登录的管理员信息
app.get('/api/admin/profile', requireAuth, (req, res) => {
    const sql = 'SELECT id, username, email, full_name, last_login FROM admins WHERE id = ?';
    req.db.get(sql, [req.session.adminId], (err, admin) => {
        if (err) {
            console.error('获取管理员信息失败:', err.message);
            res.status(500).json({ error: '获取管理员信息失败' });
        } else if (!admin) {
            res.status(404).json({ error: '管理员不存在' });
        } else {
            res.json(admin);
        }
    });
});

// 获取系统设置
app.get('/api/admin/settings', requireAuth, (req, res) => {
    const sql = 'SELECT * FROM system_settings ORDER BY setting_key';
    req.db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('获取系统设置失败:', err.message);
            res.status(500).json({ error: '获取系统设置失败' });
        } else {
            res.json(rows);
        }
    });
});

// 更新系统设置
app.put('/api/admin/settings/:key', requireAuth, (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!value && value !== '') {
        return res.status(400).json({ error: '设置值不能为空' });
    }
    
    const sql = 'UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?';
    req.db.run(sql, [value, key], function(err) {
        if (err) {
            console.error('更新系统设置失败:', err.message);
            res.status(500).json({ error: '更新系统设置失败' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: '设置项不存在' });
        } else {
            res.json({ message: '设置更新成功' });
        }
    });
});

// ===========================================
// 学年学期管理API
// ===========================================

// 获取所有学期
app.get('/api/admin/semesters', requireAuth, (req, res) => {
    const sql = 'SELECT * FROM semester_config ORDER BY start_date DESC';
    req.db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('获取学期列表失败:', err.message);
            res.status(500).json({ error: '获取学期列表失败' });
        } else {
            res.json(rows || []);
        }
    });
});

// 创建学期
app.post('/api/admin/semesters', requireAuth, (req, res) => {
    const { semesterName, startDate, endDate, isCurrent } = req.body;
    
    if (!semesterName || !startDate || !endDate) {
        return res.status(400).json({ error: '学期名称、开始日期和结束日期不能为空' });
    }
    
    req.db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
            return res.status(500).json({ error: '创建学期失败' });
        }
        
        // 如果设置为当前学期，先取消其他学期的当前状态
        const updateOthersSql = isCurrent ? 
            'UPDATE semester_config SET is_current = FALSE' : '';
        
        const executeUpdate = () => {
            const insertSql = `
                INSERT INTO semester_config (semester_name, start_date, end_date, is_current)
                VALUES (?, ?, ?, ?)
            `;
            
            req.db.run(insertSql, [semesterName, startDate, endDate, isCurrent || false], function(err) {
                if (err) {
                    req.db.run('ROLLBACK');
                    console.error('创建学期失败:', err.message);
                    res.status(500).json({ error: '创建学期失败' });
                } else {
                    req.db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            res.status(500).json({ error: '创建学期失败' });
                        } else {
                            res.json({ message: '学期创建成功', semesterId: this.lastID });
                        }
                    });
                }
            });
        };
        
        if (isCurrent) {
            req.db.run(updateOthersSql, [], (err) => {
                if (err) {
                    req.db.run('ROLLBACK');
                    return res.status(500).json({ error: '创建学期失败' });
                }
                executeUpdate();
            });
        } else {
            executeUpdate();
        }
    });
});

// 更新学期
app.put('/api/admin/semesters/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { semesterName, startDate, endDate, isCurrent } = req.body;
    
    if (!semesterName || !startDate || !endDate) {
        return res.status(400).json({ error: '学期名称、开始日期和结束日期不能为空' });
    }
    
    req.db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
            return res.status(500).json({ error: '更新学期失败' });
        }
        
        const executeUpdate = () => {
            const updateSql = `
                UPDATE semester_config 
                SET semester_name = ?, start_date = ?, end_date = ?, is_current = ?
                WHERE id = ?
            `;
            
            req.db.run(updateSql, [semesterName, startDate, endDate, isCurrent || false, id], function(err) {
                if (err) {
                    req.db.run('ROLLBACK');
                    console.error('更新学期失败:', err.message);
                    res.status(500).json({ error: '更新学期失败' });
                } else if (this.changes === 0) {
                    req.db.run('ROLLBACK');
                    res.status(404).json({ error: '学期不存在' });
                } else {
                    req.db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            res.status(500).json({ error: '更新学期失败' });
                        } else {
                            res.json({ message: '学期更新成功' });
                        }
                    });
                }
            });
        };
        
        if (isCurrent) {
            // 先取消其他学期的当前状态
            req.db.run('UPDATE semester_config SET is_current = FALSE WHERE id != ?', [id], (err) => {
                if (err) {
                    req.db.run('ROLLBACK');
                    return res.status(500).json({ error: '更新学期失败' });
                }
                executeUpdate();
            });
        } else {
            executeUpdate();
        }
    });
});

// 删除学期
app.delete('/api/admin/semesters/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    // 检查是否有关联的课程表
    const checkSql = 'SELECT COUNT(*) as count FROM schedules WHERE semester_id = ?';
    req.db.get(checkSql, [id], (err, row) => {
        if (err) {
            console.error('检查学期关联失败:', err.message);
            return res.status(500).json({ error: '删除学期失败' });
        }
        
        if (row.count > 0) {
            return res.status(400).json({ error: '该学期下有课程表，无法删除' });
        }
        
        const deleteSql = 'DELETE FROM semester_config WHERE id = ?';
        req.db.run(deleteSql, [id], function(err) {
            if (err) {
                console.error('删除学期失败:', err.message);
                res.status(500).json({ error: '删除学期失败' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: '学期不存在' });
            } else {
                res.json({ message: '学期删除成功' });
            }
        });
    });
});

// ===========================================
// 课程表管理API
// ===========================================

// 获取所有课程表（包括归档的）
app.get('/api/admin/schedules', requireAuth, (req, res) => {
    const { includeArchived } = req.query;
    
    let sql = `
        SELECT s.*, t.name as teacher_name, sem.semester_name, a.username as archived_by_name
        FROM schedules s
        LEFT JOIN teachers t ON s.teacher_id = t.id
        LEFT JOIN semester_config sem ON s.semester_id = sem.id
        LEFT JOIN admins a ON s.archived_by = a.id
    `;
    
    if (includeArchived !== 'true') {
        sql += ' WHERE s.is_archived = FALSE';
    }
    
    sql += ' ORDER BY s.created_at DESC';
    
    console.log('执行课程表查询SQL:', sql);
    req.db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('获取课程表列表失败:', err.message);
            res.status(500).json({ error: '获取课程表列表失败' });
        } else {
            console.log('课程表查询结果:', rows);
            res.json(rows || []);
        }
    });
});

// 归档课程表
app.put('/api/admin/schedules/:id/archive', requireAuth, (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.session.adminId;
    
    const sql = `
        UPDATE schedules 
        SET is_archived = TRUE, archived_at = CURRENT_TIMESTAMP, archived_by = ?, notes = ?
        WHERE id = ? AND is_archived = FALSE
    `;
    
    req.db.run(sql, [adminId, notes || null, id], function(err) {
        if (err) {
            console.error('归档课程表失败:', err.message);
            res.status(500).json({ error: '归档课程表失败' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: '课程表不存在或已归档' });
        } else {
            res.json({ message: '课程表已归档' });
        }
    });
});

// 恢复课程表
app.put('/api/admin/schedules/:id/restore', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const sql = `
        UPDATE schedules 
        SET is_archived = FALSE, archived_at = NULL, archived_by = NULL, notes = NULL
        WHERE id = ? AND is_archived = TRUE
    `;
    
    req.db.run(sql, [id], function(err) {
        if (err) {
            console.error('恢复课程表失败:', err.message);
            res.status(500).json({ error: '恢复课程表失败' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: '课程表不存在或未归档' });
        } else {
            res.json({ message: '课程表已恢复' });
        }
    });
});

// 永久删除课程表
app.delete('/api/admin/schedules/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    req.db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
            return res.status(500).json({ error: '删除课程表失败' });
        }
        
        // 先删除课程安排
        req.db.run('DELETE FROM course_arrangements WHERE schedule_id = ?', [id], (err1) => {
            if (err1) {
                req.db.run('ROLLBACK');
                console.error('删除课程安排失败:', err1.message);
                return res.status(500).json({ error: '删除课程表失败' });
            }
            
            // 删除操作历史
            req.db.run('DELETE FROM operation_history WHERE schedule_id = ?', [id], (err2) => {
                if (err2) {
                    req.db.run('ROLLBACK');
                    console.error('删除操作历史失败:', err2.message);
                    return res.status(500).json({ error: '删除课程表失败' });
                }
                
                // 删除课程表
                req.db.run('DELETE FROM schedules WHERE id = ?', [id], function(err3) {
                    if (err3) {
                        req.db.run('ROLLBACK');
                        console.error('删除课程表失败:', err3.message);
                        res.status(500).json({ error: '删除课程表失败' });
                    } else if (this.changes === 0) {
                        req.db.run('ROLLBACK');
                        res.status(404).json({ error: '课程表不存在' });
                    } else {
                        req.db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                res.status(500).json({ error: '删除课程表失败' });
                            } else {
                                res.json({ message: '课程表已永久删除' });
                            }
                        });
                    }
                });
            });
        });
    });
});

// 创建新课程表
app.post('/api/admin/schedules', requireAuth, (req, res) => {
    const { teacherId, name, semesterId } = req.body;
    
    if (!teacherId || !name || !semesterId) {
        return res.status(400).json({ error: '教师、课程表名称和学期不能为空' });
    }
    
    const sql = `
        INSERT INTO schedules (teacher_id, name, semester_id)
        VALUES (?, ?, ?)
    `;
    
    req.db.run(sql, [teacherId, name, semesterId], function(err) {
        if (err) {
            console.error('创建课程表失败:', err.message);
            res.status(500).json({ error: '创建课程表失败' });
        } else {
            res.json({ message: '课程表创建成功', scheduleId: this.lastID });
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