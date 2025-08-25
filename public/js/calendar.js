// 日历管理器

/**
 * 日历管理器类
 */
class CalendarManager {
    constructor(scheduleManager) {
        this.scheduleManager = scheduleManager;
        this.currentDate = DateUtils.getBeijingTime();
        this.selectedDates = new Set();
        this.specialCareDates = new Map();
        
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.bindEvents();
        console.log('日历管理器初始化完成');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 日历关闭按钮
        const closeBtn = DOMUtils.$('#calendar-close');
        if (closeBtn) {
            DOMUtils.on(closeBtn, 'click', () => {
                this.hide();
            });
        }

        // 月份导航
        const prevBtn = DOMUtils.$('#calendar-prev-month');
        const nextBtn = DOMUtils.$('#calendar-next-month');
        
        if (prevBtn) {
            DOMUtils.on(prevBtn, 'click', () => {
                this.changeMonth(-1);
            });
        }
        
        if (nextBtn) {
            DOMUtils.on(nextBtn, 'click', () => {
                this.changeMonth(1);
            });
        }
    }

    /**
     * 显示日历
     */
    async show() {
        const calendarView = DOMUtils.$('#calendar-view');
        if (!calendarView) return;

        DOMUtils.show(calendarView);
        
        // 加载特需托管数据
        await this.loadSpecialCareDates();
        
        // 渲染日历
        this.renderCalendar();
    }

    /**
     * 隐藏日历
     */
    hide() {
        const calendarView = DOMUtils.$('#calendar-view');
        if (calendarView) {
            DOMUtils.hide(calendarView);
        }
    }

    /**
     * 加载特需托管日期
     */
    async loadSpecialCareDates() {
        if (!this.scheduleManager.currentSchedule) return;

        try {
            const specialCare = await API.SpecialCare.getBySchedule(
                this.scheduleManager.currentSchedule.id
            );
            
            this.specialCareDates.clear();
            specialCare.forEach(care => {
                const dateKey = care.specific_date;
                if (!this.specialCareDates.has(dateKey)) {
                    this.specialCareDates.set(dateKey, []);
                }
                this.specialCareDates.get(dateKey).push(care);
            });
            
        } catch (error) {
            console.error('加载特需托管日期失败:', error);
        }
    }

    /**
     * 渲染日历
     */
    renderCalendar() {
        // 更新月份年份显示
        this.updateMonthYearDisplay();
        
        // 渲染日历网格
        this.renderCalendarGrid();
    }

    /**
     * 更新月份年份显示
     */
    updateMonthYearDisplay() {
        const monthYearElement = DOMUtils.$('#calendar-month-year');
        if (monthYearElement) {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth() + 1;
            monthYearElement.textContent = `${year}年${month}月`;
        }
    }

    /**
     * 渲染日历网格
     */
    renderCalendarGrid() {
        const calendarGrid = DOMUtils.$('#calendar-grid');
        if (!calendarGrid) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 获取月份的所有日期
        const dates = DateUtils.getMonthDates(year, month);
        
        calendarGrid.innerHTML = `
            <div class="calendar-weekdays">
                <div class="calendar-weekday">日</div>
                <div class="calendar-weekday">一</div>
                <div class="calendar-weekday">二</div>
                <div class="calendar-weekday">三</div>
                <div class="calendar-weekday">四</div>
                <div class="calendar-weekday">五</div>
                <div class="calendar-weekday">六</div>
            </div>
            <div class="calendar-days">
                ${dates.map(date => this.renderCalendarDay(date, month)).join('')}
            </div>
        `;

        // 绑定日期点击事件
        this.bindDateClickEvents();
    }

    /**
     * 渲染单个日历日期
     */
    renderCalendarDay(date, currentMonth) {
        const dateStr = DateUtils.formatDate(date);
        const isCurrentMonth = date.getMonth() === currentMonth;
        const isToday = DateUtils.formatDate(date) === DateUtils.formatDate(DateUtils.getBeijingTime());
        const hasSpecialCare = this.specialCareDates.has(dateStr);
        const isSelected = this.selectedDates.has(dateStr);
        const isWeekday = date.getDay() >= 1 && date.getDay() <= 5; // 周一到周五

        let classes = ['calendar-day'];
        if (!isCurrentMonth) classes.push('other-month');
        if (isToday) classes.push('today');
        if (hasSpecialCare) classes.push('has-special-care');
        if (isSelected) classes.push('selected');

        // 特需托管指示器
        let specialCareIndicator = '';
        if (hasSpecialCare) {
            const count = this.specialCareDates.get(dateStr).length;
            specialCareIndicator = `<div class="special-care-count">${count}</div>`;
        }

        return `
            <div class="${classes.join(' ')}" 
                 data-date="${dateStr}" 
                 data-weekday="${date.getDay()}"
                 style="cursor: ${isWeekday ? 'pointer' : 'default'}">
                <div class="calendar-day-number">${date.getDate()}</div>
                ${specialCareIndicator}
                ${this.renderCalendarTooltip(date, hasSpecialCare)}
            </div>
        `;
    }

    /**
     * 渲染日历工具提示
     */
    renderCalendarTooltip(date, hasSpecialCare) {
        const dateStr = DateUtils.formatDate(date);
        let tooltipContent = dateStr;
        
        if (hasSpecialCare) {
            const specialCareList = this.specialCareDates.get(dateStr);
            const careNames = specialCareList.map(care => care.course_name).join('、');
            tooltipContent += `\n特需托管: ${careNames}`;
        }

        return `<div class="calendar-tooltip">${tooltipContent.replace('\n', '<br>')}</div>`;
    }

    /**
     * 绑定日期点击事件
     */
    bindDateClickEvents() {
        const calendarDays = DOMUtils.$$('.calendar-day');
        calendarDays.forEach(day => {
            DOMUtils.on(day, 'click', (e) => {
                const weekday = parseInt(day.dataset.weekday);
                
                // 只允许点击工作日
                if (weekday >= 1 && weekday <= 5) {
                    this.handleDateClick(day);
                }
            });
        });
    }

    /**
     * 处理日期点击
     */
    handleDateClick(dayElement) {
        const dateStr = dayElement.dataset.date;
        const hasSpecialCare = this.specialCareDates.has(dateStr);

        if (hasSpecialCare) {
            // 显示特需托管详情
            this.showSpecialCareDetails(dateStr);
        } else {
            // 添加特需托管
            this.showAddSpecialCareModal(dateStr);
        }
    }

    /**
     * 显示特需托管详情
     */
    showSpecialCareDetails(dateStr) {
        const specialCareList = this.specialCareDates.get(dateStr);
        if (!specialCareList || specialCareList.length === 0) return;

        const modal = new ModalManager();
        const listHtml = specialCareList.map(care => `
            <div class="special-care-item">
                <div class="special-care-info">
                    <div class="special-care-course">${care.course_name}</div>
                    <div style="font-size: 12px; color: #666;">
                        教室: ${care.classroom || '未指定'} | 
                        日期: ${DateUtils.formatDate(DateUtils.parseDate(care.specific_date), 'MM-DD')}
                    </div>
                </div>
                <div class="special-care-actions">
                    <button class="btn btn-outline" style="font-size: 11px; padding: 2px 6px;" 
                            onclick="calendarManager.editSpecialCare(${care.id})">编辑</button>
                    <button class="btn btn-outline" style="font-size: 11px; padding: 2px 6px;" 
                            onclick="calendarManager.deleteSpecialCare(${care.id})">删除</button>
                </div>
            </div>
        `).join('');

        modal.show({
            title: `特需托管 - ${dateStr}`,
            content: `
                <div class="special-care-list">
                    ${listHtml}
                </div>
                <div style="margin-top: 15px;">
                    <button class="btn btn-primary" onclick="calendarManager.showAddSpecialCareModal('${dateStr}'); modal.hide();">
                        添加特需托管
                    </button>
                </div>
            `,
            confirmText: '关闭',
            onConfirm: () => true
        });
    }

    /**
     * 显示添加特需托管模态框
     */
    showAddSpecialCareModal(dateStr) {
        if (!this.scheduleManager.currentSchedule) {
            NotificationUtils.warning('请先选择教师');
            return;
        }

        // 检查是否在编辑模式
        if (!this.scheduleManager.isEditMode) {
            NotificationUtils.warning('请先进入编辑模式才能添加特需托管');
            return;
        }

        const modal = new ModalManager();
        modal.show({
            title: `添加特需托管 - ${dateStr}`,
            content: `
                <form id="add-special-care-form" class="form-container">
                    <div class="form-group">
                        <label class="form-label required">托管内容</label>
                        <input type="text" name="course_name" class="form-input" required 
                               placeholder="请输入托管内容" value="特需托管">
                    </div>
                    <div class="form-group">
                        <label class="form-label">教室</label>
                        <input type="text" name="classroom" class="form-input" 
                               placeholder="请输入教室号">
                    </div>
                    <div class="form-group">
                        <label class="form-label">备注</label>
                        <textarea name="notes" class="form-textarea" 
                                  placeholder="请输入备注信息"></textarea>
                    </div>
                    <input type="hidden" name="specific_date" value="${dateStr}">
                </form>
            `,
            confirmText: '添加',
            onConfirm: () => this.handleAddSpecialCare()
        });
    }

    /**
     * 处理添加特需托管
     */
    async handleAddSpecialCare() {
        const form = DOMUtils.$('#add-special-care-form');
        const formData = new FormData(form);
        
        const specialCareData = {
            scheduleId: this.scheduleManager.currentSchedule.id,
            specificDate: formData.get('specific_date'),
            courseName: formData.get('course_name'),
            classroom: formData.get('classroom'),
            notes: formData.get('notes'),
            isEditMode: this.scheduleManager.isEditMode
        };

        // 验证
        if (!specialCareData.courseName.trim()) {
            NotificationUtils.warning('请输入托管内容');
            return false;
        }

        try {
            await API.SpecialCare.create(specialCareData);
            NotificationUtils.success('特需托管添加成功');
            
            // 重新加载数据
            await this.loadSpecialCareDates();
            this.renderCalendar();
            
            // 如果当前显示的是这一周，也更新课程表
            if (this.scheduleManager.isEditMode) {
                await this.scheduleManager.loadOriginalCourses();
            } else {
                await this.scheduleManager.loadWeekSchedule();
            }
            
            return true;
        } catch (error) {
            console.error('添加特需托管失败:', error);
            NotificationUtils.error('添加特需托管失败');
            return false;
        }
    }

    /**
     * 编辑特需托管
     */
    async editSpecialCare(careId) {
        // 检查是否在编辑模式
        if (!this.scheduleManager.isEditMode) {
            NotificationUtils.warning('请先进入编辑模式才能编辑特需托管');
            return;
        }

        console.log('编辑特需托管:', careId);
        NotificationUtils.info('编辑功能待实现');
    }

    /**
     * 删除特需托管
     */
    async deleteSpecialCare(careId) {
        // 在普通模式下，只能删除临时特需托管
        if (!this.scheduleManager.isEditMode) {
            NotificationUtils.warning('请先进入编辑模式才能删除特需托管');
            return;
        }

        if (!confirm('确定要删除这个特需托管吗？这将从原始课程表中删除。')) {
            return;
        }

        try {
            await API.SpecialCare.delete(careId);
            NotificationUtils.success('特需托管删除成功');
            
            // 重新加载数据
            await this.loadSpecialCareDates();
            this.renderCalendar();
            
            // 更新课程表
            await this.scheduleManager.loadOriginalCourses();
            
        } catch (error) {
            console.error('删除特需托管失败:', error);
            NotificationUtils.error('删除特需托管失败');
        }
    }

    /**
     * 切换月份
     */
    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderCalendar();
    }

    /**
     * 跳转到指定日期
     */
    goToDate(date) {
        this.currentDate = new Date(date);
        this.renderCalendar();
    }

    /**
     * 获取当前显示的月份
     */
    getCurrentMonth() {
        return {
            year: this.currentDate.getFullYear(),
            month: this.currentDate.getMonth() + 1
        };
    }
}

// 导出到全局
window.CalendarManager = CalendarManager; 