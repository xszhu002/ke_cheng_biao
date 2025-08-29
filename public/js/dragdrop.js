// 拖拽管理器

/**
 * 拖拽管理器类
 */
class DragDropManager {
    constructor(scheduleManager) {
        this.scheduleManager = scheduleManager;
        this.draggedElement = null;
        this.draggedData = null;
        this.dropTarget = null;
        this.ghostElement = null;
        
        this.init();
    }

    /**
     * 初始化拖拽功能
     */
    init() {
        this.bindEvents();
        console.log('拖拽管理器初始化完成');
    }

    /**
     * 绑定拖拽事件
     */
    bindEvents() {
        // 使用事件委托监听整个课程表容器
        const scheduleTable = DOMUtils.$('#schedule-table');
        if (!scheduleTable) return;

        // 拖拽开始
        DOMUtils.on(scheduleTable, 'dragstart', (e) => {
            if (e.target.classList.contains('course-block')) {
                this.handleDragStart(e);
            }
        });

        // 拖拽结束
        DOMUtils.on(scheduleTable, 'dragend', (e) => {
            if (e.target.classList.contains('course-block')) {
                this.handleDragEnd(e);
            }
        });

        // 拖拽悬停
        DOMUtils.on(scheduleTable, 'dragover', (e) => {
            this.handleDragOver(e);
        });

        // 拖拽进入
        DOMUtils.on(scheduleTable, 'dragenter', (e) => {
            this.handleDragEnter(e);
        });

        // 拖拽离开
        DOMUtils.on(scheduleTable, 'dragleave', (e) => {
            this.handleDragLeave(e);
        });

        // 放置
        DOMUtils.on(scheduleTable, 'drop', (e) => {
            this.handleDrop(e);
        });

        // 课程块点击事件
        DOMUtils.on(scheduleTable, 'click', (e) => {
            if (e.target.closest('.course-block')) {
                this.handleCourseClick(e);
            }
            // 移除时间槽点击处理，现在由ScheduleManager处理（用于添加任务）
        });
    }

    /**
     * 处理拖拽开始
     */
    handleDragStart(e) {
        const courseBlock = e.target;
        
        // 检查是否为特需托管，特需托管不允许拖拽
        if (courseBlock.dataset.courseType === 'special_care') {
            e.preventDefault();
            showWarning('特需托管课程不能拖拽移动，请通过日历视图进行管理');
            return;
        }
        
        this.draggedElement = courseBlock;
        
        // 获取课程数据
        this.draggedData = {
            courseId: courseBlock.dataset.courseId,
            careId: courseBlock.dataset.careId,
            weekday: parseInt(courseBlock.dataset.weekday),
            timeSlot: parseInt(courseBlock.dataset.timeSlot),
            courseType: courseBlock.dataset.courseType,
            specificDate: courseBlock.dataset.specificDate,
            courseName: courseBlock.querySelector('.course-name')?.textContent,
            classroom: courseBlock.querySelector('.course-classroom')?.textContent
        };

        // 设置拖拽数据
        e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
        e.dataTransfer.effectAllowed = 'move';

        // 添加拖拽样式
        courseBlock.classList.add('dragging');
        
        // 创建拖拽预览
        this.createDragGhost(courseBlock);

        console.log('开始拖拽课程:', this.draggedData);
    }

    /**
     * 处理拖拽结束
     */
    handleDragEnd(e) {
        const courseBlock = e.target;
        
        // 移除拖拽样式
        courseBlock.classList.remove('dragging');
        
        // 清理拖拽状态
        this.clearDragState();
        
        // 移除所有拖拽相关的样式
        this.clearDropTargets();

        console.log('拖拽结束');
    }

    /**
     * 处理拖拽悬停
     */
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * 处理拖拽进入
     */
    handleDragEnter(e) {
        const timeSlot = e.target.closest('.time-slot');
        if (timeSlot && this.draggedData) {
            // 验证是否可以放置
            const canDrop = this.validateDrop(timeSlot);
            
            if (canDrop) {
                timeSlot.classList.add('drag-over');
                this.dropTarget = timeSlot;
            } else {
                timeSlot.classList.add('drag-invalid');
            }
        }
    }

    /**
     * 处理拖拽离开
     */
    handleDragLeave(e) {
        const timeSlot = e.target.closest('.time-slot');
        if (timeSlot) {
            timeSlot.classList.remove('drag-over', 'drag-invalid');
        }
    }

    /**
     * 处理放置
     */
    async handleDrop(e) {
        e.preventDefault();
        
        const timeSlot = e.target.closest('.time-slot');
        if (!timeSlot || !this.draggedData) return;

        // 验证放置
        if (!this.validateDrop(timeSlot)) {
            NotificationUtils.warning('不能放置到该位置');
            return;
        }

        // 获取目标位置信息
        const targetWeekday = parseInt(timeSlot.dataset.weekday);
        const targetTimeSlot = parseInt(timeSlot.dataset.timeSlot);

        try {
            // 执行移动
            await this.moveCourse(targetWeekday, targetTimeSlot);
            
            showSuccess('课程移动成功');
            
        } catch (error) {
            console.error('移动课程失败:', error);
            showError('移动课程失败');
        }

        // 清理状态
        this.clearDropTargets();
    }

    /**
     * 验证是否可以放置
     */
    validateDrop(timeSlot) {
        if (!this.draggedData || !timeSlot) return false;

        const targetWeekday = parseInt(timeSlot.dataset.weekday);
        const targetTimeSlot = parseInt(timeSlot.dataset.timeSlot);
        
        // 不能放到原位置
        if (targetWeekday === this.draggedData.weekday && 
            targetTimeSlot === this.draggedData.timeSlot) {
            return false;
        }

        // 特需托管只能在第9个时间段
        if (this.draggedData.courseType === 'special_care' && targetTimeSlot !== 9) {
            return false;
        }

        // 常规课程不能放到第9个时间段
        if (this.draggedData.courseType === 'regular' && targetTimeSlot === 9) {
            return false;
        }

        // 检查目标位置是否已有课程
        const existingCourse = timeSlot.querySelector('.course-block');
        if (existingCourse) {
            return false;
        }

        return true;
    }

    /**
     * 移动课程
     */
    async moveCourse(targetWeekday, targetTimeSlot) {
        if (!this.scheduleManager.currentSchedule?.id) {
            throw new Error('未选择课程表');
        }

        const moveData = {
            weekday: targetWeekday,
            timeSlot: targetTimeSlot,
            scheduleId: this.scheduleManager.currentSchedule.id
        };

        console.log('移动课程数据:', moveData, this.draggedData);

        if (this.draggedData.courseType === 'special_care') {
            // 移动特需托管
            await API.SpecialCare.update(this.draggedData.careId, {
                ...moveData,
                specificDate: this.calculateTargetDate(targetWeekday)
            });
        } else {
            // 移动常规课程
            await API.Course.move(this.draggedData.courseId, moveData);
        }

        // 重新加载课程表
        await this.scheduleManager.loadWeekSchedule();
    }

    /**
     * 计算目标日期（用于特需托管）
     */
    calculateTargetDate(targetWeekday) {
        if (!this.scheduleManager.currentSemester) {
            return DateUtils.formatDate(DateUtils.getBeijingTime());
        }

        const startDate = DateUtils.parseDate(this.scheduleManager.currentSemester.start_date);
        const weekRange = DateUtils.getWeekDateRange(startDate, this.scheduleManager.currentWeek);
        
        if (weekRange) {
            const targetDate = new Date(weekRange.start);
            targetDate.setDate(targetDate.getDate() + (targetWeekday - 1));
            return DateUtils.formatDate(targetDate);
        }

        return DateUtils.formatDate(DateUtils.getBeijingTime());
    }

    /**
     * 处理课程块点击
     */
    handleCourseClick(e) {
        const courseBlock = e.target.closest('.course-block');
        if (!courseBlock) return;

        // 显示课程详情
        this.showCourseDetails(courseBlock);
    }

    /**
     * 获取删除按钮HTML
     */
    getDeleteButtonHtml(courseType, courseId) {
        // 调试信息
        console.log('getDeleteButtonHtml:', { 
            courseType, 
            courseId, 
            isEditMode: this.scheduleManager.isEditMode 
        });
        
        // 如果是特需托管且不在编辑模式，不显示删除按钮
        if (courseType === 'special_care' && !this.scheduleManager.isEditMode) {
            return '<span class="detail-tip" style="margin-left: 8px; color: #999; font-size: 12px;">进入编辑模式可删除特需托管</span>';
        }
        
        // 其他情况显示删除按钮
        return `<button class="btn btn-outline" style="margin-left: 8px;" onclick="app.dragDropManager.deleteCourse('${courseId}', '${courseType}')">
            删除课程
        </button>`;
    }

    /**
     * 显示课程详情
     */
    showCourseDetails(courseBlock) {
        const courseData = {
            courseName: courseBlock.querySelector('.course-name')?.textContent,
            classroom: courseBlock.querySelector('.course-classroom')?.textContent,
            weekday: courseBlock.dataset.weekday,
            timeSlot: courseBlock.dataset.timeSlot,
            courseType: courseBlock.dataset.courseType
        };

        // 更新右侧详情面板
        const detailsContainer = DOMUtils.$('#course-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <h4>${courseData.courseName || '未知课程'}</h4>
                <div class="detail-row">
                    <span class="detail-label">时间:</span>
                    <span class="detail-value">${AppUtils.formatWeekday(courseData.weekday)} ${AppUtils.formatTimeSlot(courseData.timeSlot)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">教室:</span>
                    <span class="detail-value">${courseData.classroom || '未指定'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">类型:</span>
                    <span class="detail-value">${courseData.courseType === 'special_care' ? '特需托管' : '常规课程'}</span>
                </div>
                <div style="margin-top: 15px;">
                    <button class="btn btn-outline" onclick="app.dragDropManager.editCourse('${courseBlock.dataset.courseId || courseBlock.dataset.careId}', '${courseData.courseType}')">
                        编辑课程
                    </button>
                    ${this.getDeleteButtonHtml(courseData.courseType, courseBlock.dataset.courseId || courseBlock.dataset.careId)}
                </div>
            `;
        }

        // 高亮选中的课程
        DOMUtils.$$('.course-block.selected').forEach(block => {
            block.classList.remove('selected');
        });
        courseBlock.classList.add('selected');
    }

    /**
     * 编辑课程
     */
    editCourse(courseId, courseType) {
        console.log('编辑课程:', courseId, courseType);
        
        // 特需托管暂不支持编辑
        if (courseType === 'special_care') {
            NotificationUtils.info('特需托管请通过日历视图进行编辑');
            return;
        }
        
        // 查找对应的课程块
        const courseBlock = DOMUtils.$(`[data-course-id="${courseId}"]`);
        if (!courseBlock) {
            NotificationUtils.error('找不到要编辑的课程');
            return;
        }
        
        // 获取课程信息
        const courseData = {
            id: courseId,
            courseName: courseBlock.querySelector('.course-name')?.textContent || '',
            classroom: courseBlock.querySelector('.course-classroom')?.textContent || '',
            weekday: courseBlock.dataset.weekday,
            timeSlot: courseBlock.dataset.timeSlot,
            scheduleId: window.app.scheduleManager.currentScheduleId
        };
        
        // 填充编辑表单
        this.openEditModal(courseData);
    }
    
    /**
     * 打开编辑模态框
     */
    openEditModal(courseData) {
        const modal = DOMUtils.$('#course-modal');
        const form = DOMUtils.$('#course-form');
        const modalTitle = modal.querySelector('.modal-title');
        
        if (!modal || !form) {
            NotificationUtils.error('找不到编辑界面');
            return;
        }
        
        // 设置标题
        modalTitle.textContent = '编辑课程';
        
        // 填充表单数据
        form.querySelector('#course-name').value = courseData.courseName;
        form.querySelector('#course-classroom').value = courseData.classroom;
        form.querySelector('#course-teacher').value = '张老师'; // 暂时固定
        form.querySelector('#course-notes').value = '';
        
        // 在表单上存储课程信息，用于更新时使用
        form.dataset.courseId = courseData.id;
        form.dataset.scheduleId = courseData.scheduleId;
        form.dataset.weekday = courseData.weekday;
        form.dataset.timeSlot = courseData.timeSlot;
        form.dataset.isEditing = 'true';
        
        // 显示模态框
        modal.style.display = 'block';
    }

    /**
     * 删除课程
     */
    async deleteCourse(courseId, courseType) {
        // 在非编辑模式下，不允许删除特需托管
        if (courseType === 'special_care' && !this.scheduleManager.isEditMode) {
            NotificationUtils.warning('请先进入编辑模式才能删除特需托管');
            return;
        }
        
        if (!confirm('确定要删除这门课程吗？')) {
            return;
        }

        try {
            // 先关闭所有模态框
            this.closeAllModals();
            
            if (courseType === 'special_care') {
                await API.SpecialCare.delete(courseId);
            } else {
                await API.Course.delete(courseId);
            }

            NotificationUtils.success('课程删除成功');
            
            // 清空详情面板
            const detailsContainer = DOMUtils.$('#course-details');
            if (detailsContainer) {
                detailsContainer.innerHTML = '<p>点击课程查看详情</p>';
            }
            
            // 重新加载课程表
            if (courseType === 'special_care') {
                // 特需托管删除后重新加载原始课程表
                await this.scheduleManager.loadOriginalCourses();
            } else {
                await this.scheduleManager.loadWeekSchedule();
            }
            
            // 再次确保模态框关闭
            setTimeout(() => {
                this.closeAllModals();
            }, 100);

        } catch (error) {
            console.error('删除课程失败:', error);
            NotificationUtils.error('删除课程失败');
        }
    }
    
    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        console.log('关闭所有模态框...');
        
        // 获取所有模态框并关闭
        const modals = [
            '#modal-overlay',
            '#course-modal', 
            '#special-care-modal',
            '#task-detail-modal',
            '#add-task-modal'
        ];
        
        modals.forEach(selector => {
            const modal = DOMUtils.$(selector);
            if (modal) {
                modal.style.display = 'none';
                // 移除可能的 flex 显示方式
                modal.style.setProperty('display', 'none', 'important');
                console.log(`已关闭模态框: ${selector}`);
            }
        });
        
        // 关闭所有具有 modal-overlay 类的元素
        const allModalOverlays = document.querySelectorAll('.modal-overlay');
        allModalOverlays.forEach(modal => {
            modal.style.display = 'none';
            modal.style.setProperty('display', 'none', 'important');
        });
        
        // 使用ModalManager的hide方法
        if (window.ModalManager) {
            try {
                const modalManager = new window.ModalManager();
                modalManager.hide();
            } catch (e) {
                console.log('ModalManager.hide() error:', e);
            }
        }
        
        // 移除任何可能的 body 滚动锁定
        document.body.style.overflow = '';
        
        console.log('所有模态框关闭完成');
    }

    /**
     * 处理时间段点击事件 - 添加新课程
     * 注意：此方法已停用，时间槽点击现在由ScheduleManager处理（用于添加任务）
     */
    // handleTimeSlotClick(e) {
    //     // 检查是否在编辑模式
    //     if (!this.scheduleManager.isEditMode) {
    //         NotificationUtils.warning('请先点击"编辑课表"按钮进入编辑模式');
    //         return;
    //     }

    //     const timeSlot = e.target.closest('.time-slot');
    //     if (!timeSlot) return;

    //     // 检查是否已有课程
    //     const existingCourse = timeSlot.querySelector('.course-block');
    //     if (existingCourse) return;

    //     // 获取时间段信息
    //     const weekday = parseInt(timeSlot.dataset.weekday);
    //     const timeSlotNumber = parseInt(timeSlot.dataset.timeSlot);

    //     // 检查是否为特需托管时间段
    //     if (timeSlotNumber === 9) {
    //         this.showAddSpecialCareDialog(weekday);
    //     } else {
    //         this.showAddCourseDialog(weekday, timeSlotNumber);
    //     }
    // }

    /**
     * 显示添加课程对话框
     */
    showAddCourseDialog(weekday, timeSlot) {
        if (!this.scheduleManager.currentSchedule?.id) {
            NotificationUtils.error('请先选择课程表');
            return;
        }

        const modal = DOMUtils.$('#course-modal');
        if (!modal) {
            console.error('找不到课程modal');
            return;
        }

        // 设置modal标题
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = '添加课程';
        }

        // 设置表单
        const form = modal.querySelector('#course-form');
        if (form) {
            form.reset();
            form.dataset.mode = 'add';
            form.dataset.weekday = weekday;
            form.dataset.timeSlot = timeSlot;
            form.dataset.scheduleId = this.scheduleManager.currentSchedule.id;
            // 清除编辑状态
            form.dataset.isEditing = '';
            form.dataset.courseId = '';
        }

        // 自动填入当前教师信息
        const teacherInput = modal.querySelector('#course-teacher');
        if (teacherInput && this.scheduleManager.currentTeacher) {
            teacherInput.value = this.scheduleManager.currentTeacher.name;
            teacherInput.readOnly = true; // 设为只读
        }

        // 显示modal
        modal.style.display = 'block';
    }

    /**
     * 显示添加特需托管对话框
     */
    showAddSpecialCareDialog(weekday) {
        if (!this.scheduleManager.currentSchedule?.id) {
            NotificationUtils.error('请先选择课程表');
            return;
        }

        // 检查是否在编辑模式
        if (!this.scheduleManager.isEditMode) {
            NotificationUtils.warning('请先进入编辑模式才能添加特需托管');
            return;
        }

        const modal = DOMUtils.$('#special-care-modal');
        if (!modal) {
            console.error('找不到特需托管modal');
            return;
        }

        // 设置modal标题
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = '添加特需托管';
        }

        // 设置表单
        const form = modal.querySelector('#special-care-form');
        if (form) {
            form.reset();
            form.dataset.mode = 'add';
            form.dataset.scheduleId = this.scheduleManager.currentSchedule.id;
        }

        // 显示modal
        modal.style.display = 'block';
    }

    /**
     * 创建拖拽预览
     */
    createDragGhost(courseBlock) {
        // 可以在这里创建自定义的拖拽预览
    }

    /**
     * 清理拖拽状态
     */
    clearDragState() {
        this.draggedElement = null;
        this.draggedData = null;
        this.dropTarget = null;
        
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
    }

    /**
     * 清理放置目标样式
     */
    clearDropTargets() {
        const timeSlots = DOMUtils.$$('.time-slot');
        timeSlots.forEach(slot => {
            slot.classList.remove('drag-over', 'drag-invalid');
        });
    }
}

// 导出到全局
window.DragDropManager = DragDropManager; 