// 课程表管理器

/**
 * 课程表管理器类
 */
class ScheduleManager {
    constructor() {
        this.currentTeacher = null;
        this.currentSchedule = null;
        this.currentWeek = 1;
        this.currentSemester = null;
        this.courses = [];
        this.specialCare = [];
        this.isEditMode = false; // 编辑模式状态
        this.originalCourses = []; // 存储原始课程数据备份
        this.infoTechColorIndex = 0; // 信息科技课程颜色索引
        
        // 时间段定义
        this.timeSlots = [
            { id: 1, name: '上午1', time: '8:30-9:10' },
            { id: 2, name: '上午2', time: '9:50-10:30' },
            { id: 3, name: '上午3', time: '10:45-11:30' },
            { id: 4, name: '午间管理', time: '午休时间' },
            { id: 5, name: '下午1', time: '13:30-14:10' },
            { id: 6, name: '下午2', time: '14:20-15:05' },
            { id: 7, name: '下午3', time: '15:15-15:55' },
            { id: 8, name: '晚托', time: '放学后托管' },
            { id: 9, name: '特需托管', time: '特殊安排' }
        ];

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        try {
            // 加载学期信息
            await this.loadSemesterInfo();
            
            // 加载教师列表
            await this.loadTeachers();
            
            // 绑定事件
            this.bindEvents();
            
            // 初始化界面状态
            this.updateWeekDisplay();
            
            // 加载待办事项列表
            this.loadTodoList();
            
        } catch (error) {
            console.error('初始化课程表管理器失败:', error);
            NotificationUtils.error('系统初始化失败');
        }
    }

    /**
     * 加载学期信息
     */
    async loadSemesterInfo() {
        try {
            const semester = await API.Calendar.getCurrentSemester();
            if (semester && semester.id) {
                this.currentSemester = semester;
                const startDate = DateUtils.parseDate(semester.start_date);
                this.currentWeek = DateUtils.calculateWeekNumber(startDate);
            }
        } catch (error) {
            console.error('加载学期信息失败:', error);
        }
    }

    /**
     * 加载教师列表
     */
    async loadTeachers() {
        try {
            const teachers = await API.Teacher.getAll();
            this.teachers = teachers; // 保存所有教师数据
            this.renderTeacherOptions(teachers);
            
            // 如果有教师，默认选择第一个
            if (teachers.length > 0) {
                await this.selectTeacher(teachers[0].id);
            }
        } catch (error) {
            console.error('加载教师列表失败:', error);
            NotificationUtils.error('加载教师列表失败');
        }
    }

    /**
     * 渲染教师选项
     */
    renderTeacherOptions(teachers) {
        const select = DOMUtils.$('#teacher-select');
        if (!select) return;

        // 清空现有选项
        select.innerHTML = '<option value="">请选择教师...</option>';

        teachers.forEach(teacher => {
            const option = DOMUtils.createElement('option', {
                value: teacher.id
            }, teacher.name);
            select.appendChild(option);
        });
    }

    /**
     * 选择教师
     */
    async selectTeacher(teacherId) {
        if (!teacherId) {
            this.currentTeacher = null;
            this.currentSchedule = null;
            this.clearScheduleTable();
            return;
        }

        try {
            APIUtils.LoadingUtils.show('加载课程表...');
            
            // 查找教师信息
            const teacher = this.teachers?.find(t => t.id == teacherId);
            
            // 获取教师的课程表
            const schedule = await API.Schedule.getByTeacher(teacherId);
            
            if (schedule && schedule.id) {
                this.currentTeacher = teacher; // 保存完整的教师信息
                this.currentSchedule = schedule;
                
                // 加载当前周的课程数据
                await this.loadWeekSchedule();
                
                // 更新界面
                this.updateTeacherDisplay(schedule.teacher_name);
                
                // 加载待办事项列表
                this.loadTodoList();
                
                // 触发教师变化事件
                const teacherChangedEvent = new CustomEvent('teacherChanged', {
                    detail: { 
                        teacherId: this.currentTeacher.id, 
                        scheduleId: this.currentSchedule.id 
                    }
                });
                document.dispatchEvent(teacherChangedEvent);
                
                // 触发周次变化事件
                const currentYear = new Date().getFullYear();
                const weekChangedEvent = new CustomEvent('weekChanged', {
                    detail: { year: currentYear, week: this.currentWeek }
                });
                document.dispatchEvent(weekChangedEvent);
            } else {
                NotificationUtils.warning('该教师还没有创建课程表');
                this.clearScheduleTable();
            }
            
        } catch (error) {
            console.error('选择教师失败:', error);
            NotificationUtils.error('加载教师课程表失败');
        } finally {
            APIUtils.LoadingUtils.hide();
        }
    }

    /**
     * 加载指定周的课程表
     */
    async loadWeekSchedule() {
        if (!this.currentSchedule) return;

        try {
            const weekData = await API.Schedule.getWeekSchedule(this.currentSchedule.id, this.currentWeek);
            
            this.courses = weekData.regularCourses || [];
            this.specialCare = weekData.specialCare || [];
            
            // 注意：不再重置颜色索引，因为现在颜色基于课程ID分配，无需重置
            
            // 渲染课程表
            this.renderScheduleTable();
            
            // 更新日期范围显示
            this.updateDateRangeDisplay(weekData.weekStart, weekData.weekEnd);
            
        } catch (error) {
            console.error('加载周课程表失败:', error);
            NotificationUtils.error('加载课程表失败');
        }
    }

    /**
     * 渲染课程表
     */
    renderScheduleTable() {
        // 更新表头日期
        this.updateScheduleHeader();
        
        // 清空现有课程
        this.clearScheduleTable();
        
        // 渲染常规课程（前8个时间段）
        this.courses.forEach(course => {
            if (course.weekday && course.time_slot <= 8) {
                this.renderCourseBlock(course);
            }
        });
        
        // 渲染特需托管（第9个时间段）
        this.specialCare.forEach(care => {
            this.renderSpecialCareBlock(care);
        });
        
        // 为空时间槽加载任务图标
        this.loadEmptySlotTaskIcons();
    }

    /**
     * 更新课表表头日期
     */
    updateScheduleHeader() {
        if (!this.currentSemester || !this.currentSemester.start_date) {
            return;
        }

        const startDate = DateUtils.parseDate(this.currentSemester.start_date);
        const weekRange = DateUtils.getWeekDateRange(startDate, this.currentWeek);
        
        if (!weekRange) return;

        // 获取表头的星期列
        const headers = DOMUtils.$$('#schedule-table thead th');
        const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五'];
        
        // 更新每个星期列的标题
        weekdays.forEach((weekday, index) => {
            const headerIndex = index + 1; // 跳过第一列（时间/节数）
            if (headers[headerIndex]) {
                const date = new Date(weekRange.start);
                date.setDate(weekRange.start.getDate() + index);
                
                const monthDay = DateUtils.formatDate(date, 'MM-DD');
                headers[headerIndex].textContent = `${weekday} ${monthDay}`;
            }
        });
    }

    /**
     * 加载课程相关任务图标
     */
    async loadCourseTaskIcons(course, taskIconsContainer) {
        if (!this.currentSchedule) return;

        try {
            const tasks = await API.Task.getCourseTask(
                this.currentSchedule.id, 
                course.weekday, 
                course.time_slot,
                this.currentTeacher?.id
            );

            // 清空现有图标
            taskIconsContainer.innerHTML = '';

            if (tasks.length === 0) return;

                    // 直接为每个任务创建图标，显示任务标题
        tasks.forEach(task => {
            const icon = this.createTaskIcon(task.task_type || 'general', 1, task.title, task.status);
            
            // 添加点击事件
            DOMUtils.on(icon, 'click', (e) => {
                e.stopPropagation();
                this.showTaskDetails(
                    this.currentSchedule.id,
                    course.weekday,
                    course.time_slot,
                    course.course_name
                );
            });
            
            taskIconsContainer.appendChild(icon);
        });

            // 如果有高优先级任务，添加提醒样式
            const hasHighPriority = tasks.some(task => task.priority_level === 'high');
            if (hasHighPriority) {
                taskIconsContainer.classList.add('has-urgent');
            }

        } catch (error) {
            console.error('加载课程任务失败:', error);
        }
    }



    /**
     * 创建任务图标
     */
    createTaskIcon(type, count, title, status) {
        const iconMap = {
            preparation: '📖',  // 备课
            grading: '✍️',     // 批改
            meeting: '👥',     // 会议
            assessment: '📝',  // 测评
            general: '📋'      // 其他
        };

        const isCompleted = status === 'completed';
        const className = `task-icon task-${type}${isCompleted ? ' task-completed' : ''}`;

        const icon = DOMUtils.createElement('span', {
            className: className,
            title: title || this.getTaskTypeLabel(type)  // 优先显示任务标题，没有标题时显示任务类型
        });

        icon.textContent = iconMap[type] || iconMap.general;
        
        if (count > 1) {
            const badge = DOMUtils.createElement('span', {
                className: 'task-count'
            }, count.toString());
            icon.appendChild(badge);
        }

        // 点击事件将在loadCourseTaskIcons中设置
        icon.dataset.taskType = type;
        icon.dataset.taskStatus = status || 'pending';

        return icon;
    }

    /**
     * 获取任务类型标签
     */
    getTaskTypeLabel(type) {
        const labels = {
            preparation: '备课任务',
            grading: '批改任务',
            meeting: '会议安排',
            assessment: '测评任务',
            general: '其他任务'
        };
        return labels[type] || labels.general;
    }

    /**
     * 显示任务详情模态框
     */
    async showTaskDetails(scheduleId, weekday, timeSlot, courseName) {
        this.currentTaskContext = { scheduleId, weekday, timeSlot, courseName };
        
        // 设置课程信息
        const courseInfoEl = DOMUtils.$('#task-course-info');
        const weekdayName = ['', '星期一', '星期二', '星期三', '星期四', '星期五'][weekday];
        courseInfoEl.textContent = `${courseName} (${weekdayName} 第${timeSlot}节)`;
        
        // 加载任务列表
        await this.loadTaskList();
        
        // 显示模态框
        DOMUtils.$('#task-detail-modal').style.display = 'flex';
    }

    /**
     * 加载任务列表
     */
    async loadTaskList() {
        if (!this.currentTaskContext) return;
        
        const { scheduleId, weekday, timeSlot } = this.currentTaskContext;
        const taskListEl = DOMUtils.$('#task-list');
        
        try {
            const tasks = await API.Task.getCourseTask(scheduleId, weekday, timeSlot, this.currentTeacher?.id);
            
            if (tasks.length === 0) {
                taskListEl.innerHTML = `
                    <div class="empty-tasks">
                        <div class="empty-icon">📝</div>
                        <p>暂无任务</p>
                    </div>
                `;
                return;
            }
            
            taskListEl.innerHTML = tasks.map(task => this.renderTaskItem(task)).join('');
            
        } catch (error) {
            console.error('加载任务列表失败:', error);
            taskListEl.innerHTML = '<p class="text-danger">加载任务失败</p>';
        }
    }

    /**
     * 渲染任务项
     */
    renderTaskItem(task) {
        const priorityClass = task.priority_level === 'high' ? 'high-priority' : 
                            task.priority_level === 'medium' ? 'medium-priority' : 'low-priority';
        const completedClass = task.status === 'completed' ? 'completed' : '';
        const typeLabel = this.getTaskTypeLabel(task.task_type);
        
        return `
            <div class="task-item ${priorityClass} ${completedClass}" data-task-id="${task.id}">
                <input type="checkbox" class="task-checkbox" 
                       ${task.status === 'completed' ? 'checked' : ''} 
                       onchange="scheduleManager.toggleTaskStatus(${task.id}, this.checked)">
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="task-type-badge task-type-${task.task_type}">${typeLabel}</span>
                        ${task.due_date ? `<span>📅 ${task.due_date}</span>` : ''}
                        ${task.due_time ? `<span>⏰ ${task.due_time}</span>` : ''}
                        <span>优先级: ${task.priority_level === 'high' ? '高' : task.priority_level === 'medium' ? '中' : '低'}</span>
                    </div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="scheduleManager.editTask(${task.id})" title="编辑">✏️</button>
                    <button class="task-action-btn" onclick="scheduleManager.deleteTask(${task.id})" title="删除">🗑️</button>
                </div>
            </div>
        `;
    }

    /**
     * 显示添加任务模态框
     */
    showAddTaskModal(scheduleId = null, weekday = null, timeSlot = null) {
        console.log('showAddTaskModal 被调用:', { scheduleId, weekday, timeSlot });
        console.log('当前教师:', this.currentTeacher);
        
        // 如果没有传参数，使用当前任务上下文
        if (!scheduleId && this.currentTaskContext) {
            scheduleId = this.currentTaskContext.scheduleId;
            weekday = this.currentTaskContext.weekday;
            timeSlot = this.currentTaskContext.timeSlot;
        }
        
        // 如果仍然没有参数，不能添加任务
        if (!scheduleId || !weekday || !timeSlot) {
            showError('请先选择课程时间段');
            return;
        }
        
        // 设置表单数据
        DOMUtils.$('#task-modal-title').textContent = '添加任务';
        DOMUtils.$('#task-id').value = '';
        DOMUtils.$('#task-schedule-id').value = scheduleId;
        DOMUtils.$('#task-weekday').value = weekday;
        DOMUtils.$('#task-time-slot').value = timeSlot;
        
        // 清空表单
        DOMUtils.$('#task-title').value = '';
        DOMUtils.$('#task-description').value = '';
        DOMUtils.$('#task-type').value = 'general';
        DOMUtils.$('#task-priority').value = '2';
        DOMUtils.$('#task-due-date').value = '';
        DOMUtils.$('#task-due-time').value = '';
        
        // 显示模态框
        DOMUtils.$('#add-task-modal').style.display = 'flex';
    }

    /**
     * 编辑任务
     */
    async editTask(taskId) {
        try {
            // 获取任务详情
            const tasks = await API.Task.getCourseTask(
                this.currentTaskContext.scheduleId,
                this.currentTaskContext.weekday,
                this.currentTaskContext.timeSlot,
                this.currentTeacher?.id
            );
            const task = tasks.find(t => t.id === taskId);
            
            if (!task) {
                showError('任务不存在');
                return;
            }
            
            // 填充表单
            DOMUtils.$('#task-modal-title').textContent = '编辑任务';
            DOMUtils.$('#task-id').value = task.id;
            DOMUtils.$('#task-schedule-id').value = task.schedule_id;
            DOMUtils.$('#task-weekday').value = task.weekday;
            DOMUtils.$('#task-time-slot').value = task.time_slot;
            DOMUtils.$('#task-title').value = task.title;
            DOMUtils.$('#task-description').value = task.description || '';
            DOMUtils.$('#task-type').value = task.task_type;
            DOMUtils.$('#task-priority').value = task.priority;
            DOMUtils.$('#task-due-date').value = task.due_date || '';
            DOMUtils.$('#task-due-time').value = task.due_time || '';
            
            // 显示模态框
            DOMUtils.$('#add-task-modal').style.display = 'flex';
            
        } catch (error) {
            console.error('获取任务详情失败:', error);
            showError('获取任务详情失败');
        }
    }

    /**
     * 删除任务
     */
    async deleteTask(taskId) {
        if (!confirm('确定要删除这个任务吗？')) return;
        
        try {
            await API.Task.delete(taskId);
            await this.loadTaskList();
            
            // 更新对应时间槽的任务图标
            if (this.currentTaskContext) {
                await this.updateTaskIconsForSlot(
                    this.currentTaskContext.weekday,
                    this.currentTaskContext.timeSlot
                );
            }
        } catch (error) {
            console.error('删除任务失败:', error);
            showError('删除任务失败');
        }
    }

    /**
     * 切换任务状态
     */
    async toggleTaskStatus(taskId, completed) {
        try {
            await API.Task.update(taskId, {
                status: completed ? 'completed' : 'pending'
            });
            await this.loadTaskList();
            
            // 更新对应时间槽的任务图标
            if (this.currentTaskContext) {
                await this.updateTaskIconsForSlot(
                    this.currentTaskContext.weekday,
                    this.currentTaskContext.timeSlot
                );
            }
        } catch (error) {
            console.error('更新任务状态失败:', error);
            showError('更新任务状态失败');
        }
    }

    /**
     * 处理任务表单提交
     */
    async handleTaskFormSubmit(e) {
        console.log('任务表单提交事件触发');
        e.preventDefault();
        e.stopPropagation();
        
        const taskData = {
            teacherId: this.currentTeacher?.id,
            scheduleId: parseInt(DOMUtils.$('#task-schedule-id').value),
            title: DOMUtils.$('#task-title').value.trim(),
            description: DOMUtils.$('#task-description').value.trim(),
            taskType: DOMUtils.$('#task-type').value,
            priority: parseInt(DOMUtils.$('#task-priority').value),
            dueDate: DOMUtils.$('#task-due-date').value || null,
            dueTime: DOMUtils.$('#task-due-time').value || null,
            weekday: parseInt(DOMUtils.$('#task-weekday').value),
            timeSlot: parseInt(DOMUtils.$('#task-time-slot').value)
        };
        
        console.log('任务提交数据:', taskData);
        
        if (!taskData.title) {
            showError('请输入任务标题');
            return;
        }
        
        try {
            const taskId = DOMUtils.$('#task-id').value;
            
            if (taskId) {
                // 更新任务
                await API.Task.update(parseInt(taskId), taskData);
            } else {
                // 创建新任务
                await API.Task.create(taskData);
            }
            
            // 关闭模态框
            DOMUtils.$('#add-task-modal').style.display = 'none';
            
            // 刷新任务列表和课程表
            if (this.currentTaskContext) {
                await this.loadTaskList();
            }
            await this.refreshCurrentSchedule();
            
            // 立即更新对应时间槽的任务图标
            await this.updateTaskIconsForSlot(taskData.weekday, taskData.timeSlot);
            
            // 重新加载待办事项列表
            this.loadTodoList();
            
            // 显示成功提示
            showSuccess('任务保存成功');
            
        } catch (error) {
            console.error('保存任务失败:', error);
            showError('保存任务失败');
        }
    }

    /**
     * 处理添加课程（编辑模式下）
     */
    handleAddCourse(weekday, timeSlot) {
        if (!this.currentSchedule?.id) {
            showError('请先选择课程表');
            return;
        }

        // 检查是否为特需托管时间段
        if (timeSlot === 9) {
            // 特需托管通过日历视图添加
            showInfo('特需托管请通过日历视图添加');
            return;
        }

        // 调用拖拽管理器的添加课程功能
        if (window.app && window.app.dragDropManager) {
            window.app.dragDropManager.showAddCourseDialog(weekday, timeSlot);
        } else {
            showError('系统初始化未完成，请稍后重试');
        }
    }



    /**
     * 为空时间槽加载任务图标
     */
    async loadEmptySlotTaskIcons() {
        if (!this.currentSchedule) return;
        
        // 查找所有空的时间槽
        const emptySlots = DOMUtils.$$('.time-slot.empty');
        
        for (const slot of emptySlots) {
            const weekday = parseInt(slot.dataset.weekday);
            const timeSlot = parseInt(slot.dataset.timeSlot);
            
            const taskIconsContainer = slot.querySelector('.task-icons.empty-slot-tasks');
            if (taskIconsContainer) {
                await this.loadTaskIconsForSlot(weekday, timeSlot, taskIconsContainer);
            }
        }
    }
    
    /**
     * 为指定时间槽加载任务图标
     */
    async loadTaskIconsForSlot(weekday, timeSlot, taskIconsContainer) {
        try {
            const tasks = await API.Task.getCourseTask(
                this.currentSchedule.id,
                weekday,
                timeSlot,
                this.currentTeacher?.id
            );
            
            // 清空现有图标
            taskIconsContainer.innerHTML = '';
            
            if (tasks.length === 0) return;
            
            // 直接为每个任务创建图标，显示任务标题
            tasks.forEach(task => {
                const icon = this.createTaskIcon(task.task_type || 'general', 1, task.title, task.status);
                
                // 添加点击事件
                DOMUtils.on(icon, 'click', (e) => {
                    e.stopPropagation();
                    this.showTaskDetails(
                        this.currentSchedule.id,
                        weekday,
                        timeSlot,
                        '空闲时间'
                    );
                });
                
                taskIconsContainer.appendChild(icon);
            });
            
            // 如果有高优先级任务，添加提醒样式
            const hasHighPriority = tasks.some(task => task.priority_level === 'high');
            if (hasHighPriority) {
                taskIconsContainer.classList.add('has-urgent');
            }
            
        } catch (error) {
            console.error('加载空时间槽任务失败:', error);
        }
    }

    /**
     * 更新指定时间槽的任务图标
     */
    async updateTaskIconsForSlot(weekday, timeSlot) {
        // 查找对应的时间槽
        const slot = DOMUtils.$(`.time-slot[data-weekday="${weekday}"][data-time-slot="${timeSlot}"]`);
        if (!slot) return;
        
        // 如果是空时间槽，更新空时间槽的任务图标
        if (slot.classList.contains('empty')) {
            const taskIconsContainer = slot.querySelector('.task-icons.empty-slot-tasks');
            if (taskIconsContainer) {
                await this.loadTaskIconsForSlot(weekday, timeSlot, taskIconsContainer);
            }
        } else {
            // 如果有课程，重新加载课程的任务图标
            const courseBlock = slot.querySelector('.course-block');
            const taskIconsContainer = courseBlock?.querySelector('.task-icons:not(.empty-slot-tasks)');
            if (taskIconsContainer && courseBlock) {
                const course = {
                    weekday: weekday,
                    time_slot: timeSlot,
                    course_name: courseBlock.querySelector('.course-name')?.textContent || '课程'
                };
                await this.loadCourseTaskIcons(course, taskIconsContainer);
            }
        }
    }

    /**
     * 刷新当前课程表
     */
    async refreshCurrentSchedule() {
        if (this.currentSchedule) {
            await this.loadWeekSchedule(this.currentWeek);
        }
    }

    /**
     * 清空课程表
     */
    clearScheduleTable() {
        const courseBlocks = DOMUtils.$$('.course-block');
        courseBlocks.forEach(block => {
            block.remove();
        });
        
        // 重置时间段状态并添加点击事件
        const timeSlots = DOMUtils.$$('.time-slot');
        console.log('clearScheduleTable: 找到时间槽数量:', timeSlots.length);
        
        timeSlots.forEach((slot, index) => {
            slot.classList.remove('has-course');
            slot.classList.add('empty');
            
            console.log(`处理时间槽 ${index}:`, {
                weekday: slot.dataset.weekday,
                timeSlot: slot.dataset.timeSlot,
                classList: Array.from(slot.classList)
            });
            
            // 移除之前的事件监听器
            const newSlot = slot.cloneNode(true);
            slot.parentNode.replaceChild(newSlot, slot);
            
            // 为空时间槽添加任务图标容器
            const taskIcons = DOMUtils.createElement('div', {
                className: 'task-icons empty-slot-tasks'
            });
            newSlot.appendChild(taskIcons);
            
            // 为空时间槽添加点击事件，允许添加任务
            console.log('为时间槽添加点击事件:', { weekday: newSlot.dataset.weekday, timeSlot: newSlot.dataset.timeSlot });
            
            DOMUtils.on(newSlot, 'click', (e) => {
                console.log('时间槽被点击:', newSlot, '是否为空:', newSlot.classList.contains('empty'));
                
                if (newSlot.classList.contains('empty')) {
                    const weekday = parseInt(newSlot.dataset.weekday);
                    const timeSlot = parseInt(newSlot.dataset.timeSlot);
                    
                    console.log('空单元格被点击:', { 
                        weekday, 
                        timeSlot, 
                        scheduleId: this.currentSchedule?.id,
                        isEditMode: this.isEditMode 
                    });
                    
                    // 根据编辑模式决定操作
                    if (this.isEditMode) {
                        // 编辑模式：添加课程
                        this.handleAddCourse(weekday, timeSlot);
                    } else {
                        // 非编辑模式：添加任务
                        this.showAddTaskModal(
                            this.currentSchedule.id,
                            weekday,
                            timeSlot
                        );
                    }
                }
            });
        });
    }

    /**
     * 渲染课程块
     */
    renderCourseBlock(course, isEditMode = false) {
        const timeSlot = DOMUtils.$(
            `.time-slot[data-weekday="${course.weekday}"][data-time-slot="${course.time_slot}"]`
        );
        
        if (!timeSlot) return;

        const courseBlock = DOMUtils.createElement('div', {
            className: `course-block subject-${this.getCourseSubject(course.course_name, course.weekday, course.time_slot, course.id)}`,
            draggable: true,
            dataset: {
                courseId: course.id,
                weekday: course.weekday,
                timeSlot: course.time_slot,
                courseType: course.course_type || 'regular'
            }
        });

        // 课程信息容器（水平布局）
        const courseInfo = DOMUtils.createElement('div', {
            className: 'course-info'
        });

        // 课程名称
        const courseName = DOMUtils.createElement('div', {
            className: 'course-name'
        }, course.course_name);

        // 教室信息
        const courseClassroom = DOMUtils.createElement('div', {
            className: 'course-classroom'
        }, course.classroom || '');

        // 任务图标容器
        const taskIcons = DOMUtils.createElement('div', {
            className: 'task-icons'
        });

        // 在编辑模式下添加删除按钮
        if (isEditMode) {
            const deleteBtn = DOMUtils.createElement('div', {
                className: 'delete-btn'
            }, '×');
            
            DOMUtils.on(deleteBtn, 'click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.deleteCourse(course.id, course.course_name);
            });
            
            courseBlock.appendChild(deleteBtn);
        }

        // 将课程名称和教室添加到水平布局容器
        courseInfo.appendChild(courseName);
        if (course.classroom) {
            courseInfo.appendChild(courseClassroom);
        }

        courseBlock.appendChild(courseInfo);
        courseBlock.appendChild(taskIcons);

        // 异步加载任务图标
        this.loadCourseTaskIcons(course, taskIcons);

        // 清理时间槽中的现有内容（比如空单元格的任务图标容器）
        while (timeSlot.firstChild) {
            timeSlot.removeChild(timeSlot.firstChild);
        }

        timeSlot.appendChild(courseBlock);
        timeSlot.classList.remove('empty');
        timeSlot.classList.add('has-course');
    }





    /**
     * 渲染特需托管块
     */
    renderSpecialCareBlock(care, isEditMode = false) {
        const careDate = DateUtils.parseDate(care.specific_date);
        const weekday = careDate.getDay();
        
        // 调整周日为7
        const adjustedWeekday = weekday === 0 ? 7 : weekday;
        
        // 只显示工作日的特需托管
        if (adjustedWeekday > 5) return;

        const timeSlot = DOMUtils.$(
            `.time-slot[data-weekday="${adjustedWeekday}"][data-time-slot="9"]`
        );
        
        if (!timeSlot) return;

        // 清理时间槽中的现有内容（比如空单元格的任务图标容器）
        while (timeSlot.firstChild) {
            timeSlot.removeChild(timeSlot.firstChild);
        }

        const careBlock = DOMUtils.createElement('div', {
            className: 'course-block special-care',
            dataset: {
                careId: care.id,
                specificDate: care.specific_date,
                courseType: 'special_care'
            }
        });

        // 特需托管信息容器（水平布局）
        const careInfo = DOMUtils.createElement('div', {
            className: 'course-info'
        });

        const careName = DOMUtils.createElement('div', {
            className: 'course-name'
        }, care.course_name);

        const careClassroom = DOMUtils.createElement('div', {
            className: 'course-classroom'
        }, care.classroom || '');

        // 任务图标容器（特需托管也需要支持任务）
        const taskIcons = DOMUtils.createElement('div', {
            className: 'task-icons'
        });

        // 将特需托管名称和班级添加到水平布局容器
        careInfo.appendChild(careName);
        careInfo.appendChild(careClassroom);
        
        careBlock.appendChild(careInfo);
        careBlock.appendChild(taskIcons);

        // 特需托管使用自己时间槽的任务（和常规课程一样）
        const courseForTask = {
            weekday: adjustedWeekday,
            time_slot: 9,
            course_name: care.course_name
        };
        
        console.log('特需托管任务图标加载参数:', {
            careId: care.id,
            careDate: care.specific_date,
            originalWeekday: weekday,
            adjustedWeekday: adjustedWeekday,
            timeSlot: 9,
            courseName: care.course_name
        });
        
        this.loadCourseTaskIcons(courseForTask, taskIcons);

        timeSlot.appendChild(careBlock);
        timeSlot.classList.remove('empty');
        timeSlot.classList.add('has-course');
    }

    /**
     * 获取课程科目类型（支持多彩信息科技课程）
     */
    getCourseSubject(courseName, weekday = null, timeSlot = null, courseId = null) {
        const subjectMap = {
            '数学': 'math',
            '语文': 'chinese',
            '英语': 'english',
            '科学': 'science',
            '美术': 'art',
            '体育': 'pe',
            '音乐': 'music'
        };

        // 优先检查非信息科技课程
        for (const [subject, className] of Object.entries(subjectMap)) {
            if (courseName.includes(subject)) {
                return className;
            }
        }

        // 信息科技课程使用多彩颜色
        if (courseName.includes('信息科技') || courseName.includes('信息技术') || courseName.includes('计算机')) {
            return this.getInfoTechColorClass(weekday, timeSlot, courseId);
        }

        return 'info'; // 默认
    }

    /**
     * 为信息科技课程分配多彩颜色类（基于课程ID固定颜色）
     */
    getInfoTechColorClass(weekday, timeSlot, courseId = null) {
        // 定义信息科技课程的多种颜色类
        const infoTechColors = ['info1', 'info2', 'info3', 'info4', 'info5'];
        
        // 如果有课程ID，基于课程ID分配固定颜色
        if (courseId !== null && courseId !== undefined) {
            // 使用课程ID的哈希值来分配颜色，确保颜色分布更均匀
            const hash = this.hashCode(courseId.toString());
            const colorIndex = Math.abs(hash) % infoTechColors.length;
            return infoTechColors[colorIndex];
        }
        
        // 如果没有课程ID，使用更智能的分配方式
        // 查看当前已有的信息科技课程，选择使用最少的颜色
        return this.getNextAvailableInfoColor();
    }

    /**
     * 简单的字符串哈希函数
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash;
    }

    /**
     * 获取下一个可用的信息科技颜色
     */
    getNextAvailableInfoColor() {
        const infoTechColors = ['info1', 'info2', 'info3', 'info4', 'info5'];
        
        // 统计当前已使用的颜色
        const usedColors = {};
        const courseBlocks = document.querySelectorAll('.course-block[class*="subject-info"]');
        
        courseBlocks.forEach(block => {
            for (let i = 1; i <= 5; i++) {
                if (block.classList.contains(`subject-info${i}`)) {
                    usedColors[`info${i}`] = (usedColors[`info${i}`] || 0) + 1;
                }
            }
        });
        
        // 找到使用次数最少的颜色
        let minUsage = Infinity;
        let selectedColor = infoTechColors[0];
        
        for (const color of infoTechColors) {
            const usage = usedColors[color] || 0;
            if (usage < minUsage) {
                minUsage = usage;
                selectedColor = color;
            }
        }
        
        return selectedColor;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 教师选择事件
        const teacherSelect = DOMUtils.$('#teacher-select');
        if (teacherSelect) {
            DOMUtils.on(teacherSelect, 'change', (e) => {
                this.selectTeacher(e.target.value);
            });
        }

        // 周次导航事件
        const prevWeekBtn = DOMUtils.$('#prev-week');
        const nextWeekBtn = DOMUtils.$('#next-week');
        
        if (prevWeekBtn) {
            DOMUtils.on(prevWeekBtn, 'click', () => {
                this.changeWeek(-1);
            });
        }
        
        if (nextWeekBtn) {
            DOMUtils.on(nextWeekBtn, 'click', () => {
                this.changeWeek(1);
            });
        }

        // 保存按钮
        const saveBtn = DOMUtils.$('#save-btn');
        if (saveBtn) {
            DOMUtils.on(saveBtn, 'click', () => {
                this.saveSchedule();
            });
        }

        // 编辑课表按钮
        const editBtn = DOMUtils.$('#edit-btn');
        if (editBtn) {
            DOMUtils.on(editBtn, 'click', () => {
                this.toggleEditMode();
            });
        }

        // 取消编辑按钮
        const cancelEditBtn = DOMUtils.$('#cancel-edit-btn');
        if (cancelEditBtn) {
            DOMUtils.on(cancelEditBtn, 'click', () => {
                this.cancelEdit();
            });
        }

        // 复位按钮
        const resetBtn = DOMUtils.$('#reset-btn');
        if (resetBtn) {
            DOMUtils.on(resetBtn, 'click', () => {
                this.resetSchedule();
            });
        }

        // 日历切换按钮
        const calendarToggle = DOMUtils.$('#calendar-toggle');
        if (calendarToggle) {
            DOMUtils.on(calendarToggle, 'click', () => {
                this.toggleCalendarView();
            });
        }

        // 添加教师功能移至管理员后台
    }

    /**
     * 更新周次显示
     */
    updateWeekDisplay() {
        const weekDisplay = DOMUtils.$('#current-week');
        if (weekDisplay) {
            weekDisplay.textContent = `第${this.currentWeek}周`;
        }
    }

    /**
     * 更新教师显示
     */
    updateTeacherDisplay(teacherName) {
        // 可以在这里更新界面上的教师信息显示
    }

    /**
     * 更新日期范围显示
     */
    updateDateRangeDisplay(startDate, endDate) {
        const dateRangeDisplay = DOMUtils.$('#date-range-display');
        if (dateRangeDisplay && startDate && endDate) {
            const start = DateUtils.formatDate(DateUtils.parseDate(startDate), 'MM-DD');
            const end = DateUtils.formatDate(DateUtils.parseDate(endDate), 'MM-DD');
            dateRangeDisplay.textContent = `${start} ~ ${end}`;
        }
    }

    /**
     * 切换周次
     */
    async changeWeek(delta) {
        const newWeek = this.currentWeek + delta;
        if (newWeek < 1) {
            NotificationUtils.warning('已经是第一周了');
            return;
        }

        this.currentWeek = newWeek;
        this.updateWeekDisplay();
        
        if (this.currentSchedule) {
            await this.loadWeekSchedule();
        }
        
        // 触发周次变化事件
        const currentYear = new Date().getFullYear();
        const weekChangedEvent = new CustomEvent('weekChanged', {
            detail: { year: currentYear, week: this.currentWeek }
        });
        document.dispatchEvent(weekChangedEvent);
    }

    /**
     * 保存课程表
     */
    async saveSchedule() {
        if (!this.currentSchedule) {
            NotificationUtils.warning('请先选择教师');
            return;
        }

        if (this.isEditMode) {
            // 编辑模式：保存编辑后的原始课程表
            await this.saveEditedOriginalSchedule();
        } else {
            // 普通模式：将当前课程表保存为原始课程表
            await this.saveCurrentAsOriginal();
        }
    }

    /**
     * 保存编辑后的原始课程表
     */
    async saveEditedOriginalSchedule() {
        if (confirm('确定要保存编辑后的原始课程表吗？')) {
            try {
                APIUtils.LoadingUtils.show('保存中...');
                
                const result = await API.Schedule.saveOriginal(this.currentSchedule.id);
                NotificationUtils.success(result.message || '原始课程表保存成功');
                
                // 退出编辑模式
                this.exitEditMode();
                
            } catch (error) {
                console.error('保存原始课程表失败:', error);
                NotificationUtils.error('保存失败: ' + error.message);
            } finally {
                APIUtils.LoadingUtils.hide();
            }
        }
    }

    /**
     * 将当前课程表保存为原始课程表
     */
    async saveCurrentAsOriginal() {
        if (confirm('确定要将当前课程表保存为原始课程表吗？\n这将作为今后复位的基准。')) {
            try {
                APIUtils.LoadingUtils.show('保存中...');
                
                const result = await API.Schedule.saveOriginal(this.currentSchedule.id);
                NotificationUtils.success(result.message || '原始课程表保存成功');
                
            } catch (error) {
                console.error('保存原始课程表失败:', error);
                NotificationUtils.error('保存失败: ' + error.message);
            } finally {
                APIUtils.LoadingUtils.hide();
            }
        }
    }

    /**
     * 复位课程表（恢复到原始课程表）
     */
    async resetSchedule() {
        if (!this.currentSchedule) {
            NotificationUtils.warning('请先选择教师');
            return;
        }

        if (confirm('确定要复位到原始课程表吗？\n这将清除所有临时更改。')) {
            try {
                APIUtils.LoadingUtils.show('复位中...');
                
                const result = await API.Schedule.reset(this.currentSchedule.id);
                NotificationUtils.success(result.message || '课程表已复位');
                
                // 重新加载课程表
                await this.loadWeekSchedule();
                
            } catch (error) {
                console.error('复位失败:', error);
                NotificationUtils.error('复位失败: ' + error.message);
            } finally {
                APIUtils.LoadingUtils.hide();
            }
        }
    }

    /**
     * 切换编辑模式
     */
    async toggleEditMode() {
        if (!this.currentSchedule) {
            NotificationUtils.warning('请先选择教师');
            return;
        }

        if (this.isEditMode) {
            // 退出编辑模式
            this.exitEditMode();
        } else {
            // 进入编辑模式
            await this.enterEditMode();
        }
    }

    /**
     * 清空课程详情面板
     */
    clearCourseDetails() {
        const detailsContainer = DOMUtils.$('#course-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = '<p>点击课程查看详情</p>';
        }
    }

    /**
     * 进入编辑模式
     */
    async enterEditMode() {
        try {
            APIUtils.LoadingUtils.show('加载原始课程表...');
            
            // 加载原始课程表数据
            await this.loadOriginalCourses();
            
            this.isEditMode = true;
            this.updateEditModeUI();
            
            // 清空课程详情面板
            this.clearCourseDetails();
            
            NotificationUtils.info('已进入编辑模式，可以添加、编辑、删除课程');
            
        } catch (error) {
            console.error('进入编辑模式失败:', error);
            NotificationUtils.error('进入编辑模式失败: ' + error.message);
        } finally {
            APIUtils.LoadingUtils.hide();
        }
    }

    /**
     * 退出编辑模式
     */
    exitEditMode() {
        this.isEditMode = false;
        this.originalCourses = [];
        this.updateEditModeUI();
        
        // 清空课程详情面板
        this.clearCourseDetails();
        
        // 重新加载普通课程表视图
        this.loadWeekSchedule();
        
        NotificationUtils.info('已退出编辑模式');
    }

    /**
     * 取消编辑
     */
    cancelEdit() {
        if (confirm('确定要取消编辑吗？所有未保存的更改将丢失。')) {
            this.exitEditMode();
        }
    }

    /**
     * 加载原始课程表
     */
    async loadOriginalCourses() {
        if (!this.currentSchedule) return;

        try {
            // 获取原始课程表数据（is_original = TRUE）
            const originalData = await API.Schedule.getOriginalCourses(this.currentSchedule.id);
            
            this.originalCourses = originalData.regularCourses || [];
            this.specialCare = originalData.specialCare || [];
            
            // 渲染编辑模式的课程表
            this.renderEditModeSchedule();
            
        } catch (error) {
            console.error('加载原始课程表失败:', error);
            throw error;
        }
    }

    /**
     * 渲染编辑模式的课程表
     */
    renderEditModeSchedule() {
        // 清空现有课程
        this.clearScheduleTable();
        
        // 渲染原始课程（前8个时间段）
        this.originalCourses.forEach(course => {
            if (course.weekday && course.time_slot <= 8) {
                this.renderCourseBlock(course, true); // 第二个参数表示编辑模式
            }
        });
        
        // 渲染特需托管（第9个时间段）
        this.specialCare.forEach(care => {
            this.renderSpecialCareBlock(care, true); // 第二个参数表示编辑模式
        });
    }

    /**
     * 更新编辑模式UI
     */
    updateEditModeUI() {
        const editBtn = DOMUtils.$('#edit-btn');
        const saveBtn = DOMUtils.$('#save-btn');
        const cancelEditBtn = DOMUtils.$('#cancel-edit-btn');
        const resetBtn = DOMUtils.$('#reset-btn');

        if (this.isEditMode) {
            // 编辑模式UI
            if (editBtn) editBtn.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'inline-block';
            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
            if (resetBtn) resetBtn.disabled = true;
            
            // 添加编辑模式的视觉提示
            document.body.classList.add('edit-mode');
            
        } else {
            // 普通模式UI
            if (editBtn) editBtn.style.display = 'inline-block';
            if (saveBtn) saveBtn.style.display = 'none';
            if (cancelEditBtn) cancelEditBtn.style.display = 'none';
            if (resetBtn) resetBtn.disabled = false;
            
            // 移除编辑模式的视觉提示
            document.body.classList.remove('edit-mode');
        }
    }

    /**
     * 删除课程
     */
    async deleteCourse(courseId, courseName) {
        if (!this.isEditMode) {
            NotificationUtils.warning('请先进入编辑模式');
            return;
        }

        if (confirm(`确定要删除课程"${courseName}"吗？`)) {
            try {
                APIUtils.LoadingUtils.show('删除中...');
                
                await API.Course.delete(courseId);
                NotificationUtils.success('课程删除成功');
                
                // 重新加载编辑模式的课程表
                await this.loadOriginalCourses();
                
            } catch (error) {
                console.error('删除课程失败:', error);
                NotificationUtils.error('删除失败: ' + error.message);
            } finally {
                APIUtils.LoadingUtils.hide();
            }
        }
    }

    // 特需托管删除功能已移除

    /**
     * 切换日历视图
     */
    toggleCalendarView() {
        const calendarView = DOMUtils.$('#calendar-view');
        if (calendarView) {
            const isVisible = calendarView.style.display !== 'none';
            calendarView.style.display = isVisible ? 'none' : 'flex';
            
            if (!isVisible && window.calendarManager) {
                window.calendarManager.show();
            }
        }
    }

    /**
     * 显示添加教师模态框
     */
    showAddTeacherModal() {
        const modal = new ModalManager();
        modal.show({
            title: '添加教师',
            content: `
                <form id="add-teacher-form" class="form-container">
                    <div class="form-group">
                        <label class="form-label required">教师姓名</label>
                        <input type="text" name="name" class="form-input" required placeholder="请输入教师姓名">
                    </div>
                    <div class="form-group">
                        <label class="form-label">邮箱</label>
                        <input type="email" name="email" class="form-input" placeholder="请输入邮箱地址">
                    </div>
                    <div class="form-group">
                        <label class="form-label">电话</label>
                        <input type="tel" name="phone" class="form-input" placeholder="请输入电话号码">
                    </div>
                </form>
            `,
            confirmText: '添加',
            onConfirm: () => this.handleAddTeacher()
        });
    }

    /**
     * 处理添加教师
     */
    async handleAddTeacher() {
        const form = DOMUtils.$('#add-teacher-form');
        const formData = new FormData(form);
        
        const teacherData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone')
        };

        // 验证
        if (!teacherData.name.trim()) {
            NotificationUtils.warning('请输入教师姓名');
            return false;
        }

        try {
            await API.Teacher.create(teacherData);
            NotificationUtils.success('教师添加成功');
            
            // 重新加载教师列表
            await this.loadTeachers();
            
            return true;
        } catch (error) {
            console.error('添加教师失败:', error);
            NotificationUtils.error('添加教师失败');
            return false;
        }
    }

    /**
     * 加载待办事项列表
     */
    async loadTodoList() {
        console.log('开始加载待办事项列表');
        const pendingContainer = DOMUtils.$('#todo-list-pending');
        const completedContainer = DOMUtils.$('#todo-list-completed');
        
        if (!pendingContainer || !completedContainer) {
            console.log('找不到待办事项容器');
            return;
        }

        try {
            // 显示加载状态
            pendingContainer.innerHTML = '<div class="todo-loading">正在加载待办事项...</div>';
            completedContainer.innerHTML = '<div class="todo-loading">正在加载已完成事项...</div>';

            // 获取当前教师的所有任务
            if (!this.currentTeacher) {
                console.log('当前没有选择教师');
                pendingContainer.innerHTML = '<div class="todo-empty">请先选择教师</div>';
                completedContainer.innerHTML = '<div class="todo-empty">请先选择教师</div>';
                return;
            }

            console.log('当前教师:', this.currentTeacher);
            const tasks = await API.Task.getByTeacher(this.currentTeacher.id);
            console.log('获取到的任务:', tasks);
            
            // 按状态分类任务
            const pendingTasks = tasks.filter(task => task.status !== 'completed');
            const completedTasks = tasks.filter(task => task.status === 'completed');
            
            // 按优先级排序
            const sortByPriority = (a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
            };
            
            pendingTasks.sort(sortByPriority);
            completedTasks.sort(sortByPriority);

            this.renderTodoList(pendingTasks, 'pending');
            this.renderTodoList(completedTasks, 'completed');
            
            // 初始化标签页切换事件
            this.initTodoTabs();
            
            // 调整布局高度
            this.adjustLayoutHeight();

        } catch (error) {
            console.error('加载待办事项失败:', error);
            console.error('错误详情:', error.message);
            pendingContainer.innerHTML = '<div class="todo-empty">加载失败，请稍后重试</div>';
            completedContainer.innerHTML = '<div class="todo-empty">加载失败，请稍后重试</div>';
        }
    }

    /**
     * 渲染待办事项列表
     */
    renderTodoList(tasks, type = 'pending') {
        const containerId = type === 'completed' ? '#todo-list-completed' : '#todo-list-pending';
        const todoListContainer = DOMUtils.$(containerId);
        if (!todoListContainer) return;

        todoListContainer.innerHTML = '';

        if (!tasks || tasks.length === 0) {
            const emptyMessage = type === 'completed' ? '暂无已完成事项' : '暂无待办事项';
            todoListContainer.innerHTML = `<div class="todo-empty">${emptyMessage}</div>`;
            return;
        }

        tasks.forEach(task => {
            const todoItem = this.createTodoItem(task);
            todoListContainer.appendChild(todoItem);
        });
        
        // 渲染完成后调整布局
        setTimeout(() => {
            this.adjustLayoutHeight();
        }, 50);
    }

    /**
     * 调整布局高度
     */
    adjustLayoutHeight() {
        if (window.app && typeof window.app.adjustRightPanelHeight === 'function') {
            window.app.adjustRightPanelHeight();
        }
    }

    /**
     * 创建待办事项条目
     */
    createTodoItem(task) {
        const item = DOMUtils.createElement('div', {
            className: `todo-item ${task.status === 'completed' ? 'completed' : ''}`
        });

        const priorityLabels = {
            high: '高',
            medium: '中', 
            low: '低'
        };

        const typeLabels = {
            preparation: '备课',
            grading: '批改',
            meeting: '会议',
            assessment: '测评',
            general: '其他'
        };

        item.innerHTML = `
            <div class="todo-header">
                <div style="display: flex; align-items: center;">
                    <input type="checkbox" class="todo-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
                    <span class="todo-title">${task.title}</span>
                </div>
                <span class="todo-type ${task.task_type || 'general'}">${typeLabels[task.task_type] || '其他'}</span>
            </div>
            ${task.description ? `<div class="todo-description">${task.description}</div>` : ''}
            <div class="todo-meta">
                <span class="todo-priority ${task.priority || 'medium'}">优先级: ${priorityLabels[task.priority] || '中'}</span>
                ${task.due_date ? `<span class="todo-due">截止: ${task.due_date}</span>` : ''}
            </div>
        `;

        // 添加复选框点击事件
        const checkbox = item.querySelector('.todo-checkbox');
        DOMUtils.on(checkbox, 'change', async () => {
            const newStatus = checkbox.checked ? 'completed' : 'pending';
            try {
                await API.Task.update(task.id, { status: newStatus });
                task.status = newStatus;
                
                // 更新项目样式
                if (newStatus === 'completed') {
                    item.classList.add('completed');
                } else {
                    item.classList.remove('completed');
                }
                
                // 重新加载列表以正确排序
                this.loadTodoList();
                
                // 更新课表主体上对应时间槽的任务图标
                if (task.weekday && task.time_slot) {
                    await this.updateTaskIconsForSlot(task.weekday, task.time_slot);
                }
                
            } catch (error) {
                console.error('更新任务状态失败:', error);
                checkbox.checked = !checkbox.checked; // 恢复复选框状态
            }
        });

        // 添加双击编辑事件
        DOMUtils.on(item, 'dblclick', () => {
            this.showTaskDetails(
                task.schedule_id,
                task.weekday,
                task.time_slot,
                '待办事项详情'
            );
        });

        return item;
    }

    /**
     * 初始化待办事项标签页切换
     */
    initTodoTabs() {
        const tabButtons = DOMUtils.$$('.tab-button');
        const tabPanes = DOMUtils.$$('.tab-pane');

        tabButtons.forEach(button => {
            DOMUtils.on(button, 'click', () => {
                const targetTab = button.dataset.tab;
                
                // 移除所有active类
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                
                // 激活当前标签
                button.classList.add('active');
                const targetPane = DOMUtils.$(`#todo-list-${targetTab}`);
                if (targetPane) {
                    targetPane.classList.add('active');
                }
            });
        });
    }
}

// 简单的模态框管理器
class ModalManager {
    show({ title, content, confirmText = '确认', cancelText = '取消', onConfirm, onCancel }) {
        const overlay = DOMUtils.$('#modal-overlay');
        const modalTitle = DOMUtils.$('#modal-title');
        const modalBody = DOMUtils.$('#modal-body');
        const modalConfirm = DOMUtils.$('#modal-confirm');
        const modalCancel = DOMUtils.$('#modal-cancel');

        if (!overlay) return;

        // 设置内容
        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = content;
        if (modalConfirm) modalConfirm.textContent = confirmText;
        if (modalCancel) modalCancel.textContent = cancelText;

        // 显示模态框
        DOMUtils.show(overlay);

        // 绑定确认事件
        const confirmHandler = async () => {
            if (onConfirm) {
                const result = await onConfirm();
                if (result !== false) {
                    this.hide();
                }
            } else {
                this.hide();
            }
        };

        // 绑定取消事件
        const cancelHandler = () => {
            if (onCancel) onCancel();
            this.hide();
        };

        // 移除旧的事件监听器
        const newConfirmBtn = modalConfirm.cloneNode(true);
        const newCancelBtn = modalCancel.cloneNode(true);
        modalConfirm.parentNode.replaceChild(newConfirmBtn, modalConfirm);
        modalCancel.parentNode.replaceChild(newCancelBtn, modalCancel);

        // 添加新的事件监听器
        DOMUtils.on(newConfirmBtn, 'click', confirmHandler);
        DOMUtils.on(newCancelBtn, 'click', cancelHandler);

        // 点击遮罩关闭
        DOMUtils.on(overlay, 'click', (e) => {
            if (e.target === overlay) {
                cancelHandler();
            }
        });

        // ESC键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cancelHandler();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    hide() {
        const overlay = DOMUtils.$('#modal-overlay');
        if (overlay) {
            DOMUtils.hide(overlay);
        }
    }
}

// 导出到全局
window.ScheduleManager = ScheduleManager;
window.ModalManager = ModalManager; 