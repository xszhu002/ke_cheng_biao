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
    }

    /**
     * 清空课程表
     */
    clearScheduleTable() {
        const courseBlocks = DOMUtils.$$('.course-block');
        courseBlocks.forEach(block => {
            block.remove();
        });
        
        // 重置时间段状态
        const timeSlots = DOMUtils.$$('.time-slot');
        timeSlots.forEach(slot => {
            slot.classList.remove('has-course');
            slot.classList.add('empty');
        });
    }

    /**
     * 渲染课程块
     */
    renderCourseBlock(course) {
        const timeSlot = DOMUtils.$(
            `.time-slot[data-weekday="${course.weekday}"][data-time-slot="${course.time_slot}"]`
        );
        
        if (!timeSlot) return;

        const courseBlock = DOMUtils.createElement('div', {
            className: `course-block subject-${this.getCourseSubject(course.course_name)}`,
            draggable: true,
            dataset: {
                courseId: course.id,
                weekday: course.weekday,
                timeSlot: course.time_slot,
                courseType: course.course_type || 'regular'
            }
        });

        // 课程名称
        const courseName = DOMUtils.createElement('div', {
            className: 'course-name'
        }, course.course_name);

        // 教室信息
        const courseClassroom = DOMUtils.createElement('div', {
            className: 'course-classroom'
        }, course.classroom || '');

        courseBlock.appendChild(courseName);
        if (course.classroom) {
            courseBlock.appendChild(courseClassroom);
        }

        timeSlot.appendChild(courseBlock);
        timeSlot.classList.remove('empty');
        timeSlot.classList.add('has-course');
    }

    /**
     * 渲染特需托管块
     */
    renderSpecialCareBlock(care) {
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

        const careBlock = DOMUtils.createElement('div', {
            className: 'course-block special-care',
            dataset: {
                careId: care.id,
                specificDate: care.specific_date,
                courseType: 'special_care'
            }
        });

        // 特需托管信息
        const careName = DOMUtils.createElement('div', {
            className: 'course-name'
        }, care.course_name);

        const careDate2 = DOMUtils.createElement('div', {
            className: 'course-classroom'
        }, DateUtils.formatDate(careDate, 'MM-DD'));

        careBlock.appendChild(careName);
        careBlock.appendChild(careDate2);

        timeSlot.appendChild(careBlock);
        timeSlot.classList.remove('empty');
        timeSlot.classList.add('has-course');
    }

    /**
     * 获取课程科目类型
     */
    getCourseSubject(courseName) {
        const subjectMap = {
            '信息科技': 'info',
            '数学': 'math',
            '语文': 'chinese',
            '英语': 'english',
            '科学': 'science',
            '美术': 'art',
            '体育': 'pe',
            '音乐': 'music'
        };

        for (const [subject, className] of Object.entries(subjectMap)) {
            if (courseName.includes(subject)) {
                return className;
            }
        }

        return 'info'; // 默认
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

        // 添加教师按钮
        const addTeacherBtn = DOMUtils.$('#add-teacher-btn');
        if (addTeacherBtn) {
            DOMUtils.on(addTeacherBtn, 'click', () => {
                this.showAddTeacherModal();
            });
        }
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
    }

    /**
     * 保存课程表（保存为原始课程表）
     */
    async saveSchedule() {
        if (!this.currentSchedule) {
            NotificationUtils.warning('请先选择教师');
            return;
        }

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