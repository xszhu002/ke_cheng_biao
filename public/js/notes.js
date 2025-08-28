/**
 * 随手记管理器
 */
class WeeklyNotesManager {
    constructor() {
        this.currentTeacherId = null;
        this.currentScheduleId = null;
        this.currentYear = null;
        this.currentWeek = null;
        this.isEditing = false;
        this.originalContent = '';
        
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.bindEvents();
        // 监听周次变化事件
        document.addEventListener('weekChanged', (e) => {
            this.updateWeekInfo(e.detail.year, e.detail.week);
        });
        
        // 监听教师切换事件
        document.addEventListener('teacherChanged', (e) => {
            this.updateTeacher(e.detail.teacherId, e.detail.scheduleId);
        });
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 编辑/预览切换按钮
        DOMUtils.on('#notes-toggle-mode', 'click', () => {
            this.toggleEditMode();
        });

        // 保存按钮
        DOMUtils.on('#notes-save', 'click', () => {
            this.saveNotes();
        });

        // 取消按钮
        DOMUtils.on('#notes-cancel', 'click', () => {
            this.cancelEdit();
        });

        // 键盘快捷键
        DOMUtils.on('#notes-textarea', 'keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveNotes();
            }
            if (e.key === 'Escape') {
                this.cancelEdit();
            }
        });
    }

    /**
     * 更新教师信息
     */
    updateTeacher(teacherId, scheduleId) {
        this.currentTeacherId = teacherId;
        this.currentScheduleId = scheduleId;
        this.loadNotes();
    }

    /**
     * 更新周次信息
     */
    updateWeekInfo(year, week) {
        this.currentYear = year;
        this.currentWeek = week;
        
        // 更新显示
        const weekDisplay = DOMUtils.$('#notes-week-display');
        if (weekDisplay) {
            weekDisplay.textContent = `第${week}周`;
        }
        
        this.loadNotes();
    }

    /**
     * 加载随手记
     */
    async loadNotes() {
        if (!this.currentTeacherId || !this.currentScheduleId || 
            !this.currentYear || !this.currentWeek) {
            return;
        }

        try {
            const notes = await API.WeeklyNotes.get(
                this.currentTeacherId,
                this.currentScheduleId,
                this.currentYear,
                this.currentWeek
            );
            
            this.originalContent = notes.content || '';
            this.renderPreview();
            
        } catch (error) {
            console.error('加载随手记失败:', error);
            this.showEmptyState();
        }
    }

    /**
     * 切换编辑模式
     */
    toggleEditMode() {
        if (this.isEditing) {
            this.cancelEdit();
        } else {
            this.enterEditMode();
        }
    }

    /**
     * 进入编辑模式
     */
    enterEditMode() {
        this.isEditing = true;
        
        const editor = DOMUtils.$('#notes-editor');
        const preview = DOMUtils.$('#notes-preview');
        const viewButtons = DOMUtils.$('#notes-view-buttons');
        const editButtons = DOMUtils.$('#notes-edit-buttons');
        const textarea = DOMUtils.$('#notes-textarea');
        
        // 切换显示
        editor.classList.remove('hidden');
        preview.style.display = 'none';
        viewButtons.classList.add('hidden');
        editButtons.classList.remove('hidden');
        
        // 设置编辑器内容
        textarea.value = this.originalContent;
        textarea.focus();
    }

    /**
     * 退出编辑模式
     */
    exitEditMode() {
        this.isEditing = false;
        
        const editor = DOMUtils.$('#notes-editor');
        const preview = DOMUtils.$('#notes-preview');
        const viewButtons = DOMUtils.$('#notes-view-buttons');
        const editButtons = DOMUtils.$('#notes-edit-buttons');
        
        // 切换显示
        editor.classList.add('hidden');
        preview.style.display = 'block';
        viewButtons.classList.remove('hidden');
        editButtons.classList.add('hidden');
    }

    /**
     * 取消编辑
     */
    cancelEdit() {
        this.exitEditMode();
        this.renderPreview();
    }

    /**
     * 保存随手记
     */
    async saveNotes() {
        if (!this.isEditing) return;

        const textarea = DOMUtils.$('#notes-textarea');
        const content = textarea.value.trim();

        if (!this.currentTeacherId || !this.currentScheduleId || 
            !this.currentYear || !this.currentWeek) {
            NotificationUtils.error('缺少必要信息，无法保存');
            return;
        }

        try {
            await API.WeeklyNotes.save(
                this.currentTeacherId,
                this.currentScheduleId,
                this.currentYear,
                this.currentWeek,
                content
            );

            this.originalContent = content;
            this.exitEditMode();
            this.renderPreview();
            
            NotificationUtils.success('保存成功');
            
        } catch (error) {
            console.error('保存随手记失败:', error);
            NotificationUtils.error('保存失败，请重试');
        }
    }

    /**
     * 渲染预览
     */
    renderPreview() {
        const contentDiv = DOMUtils.$('.notes-content');
        if (!contentDiv) return;

        if (!this.originalContent || this.originalContent.trim() === '') {
            this.showEmptyState();
        } else {
            const html = MarkdownUtils.parse(this.originalContent);
            contentDiv.innerHTML = html;
            contentDiv.classList.remove('empty');
        }
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        const contentDiv = DOMUtils.$('.notes-content');
        if (contentDiv) {
            contentDiv.innerHTML = '暂无记录，点击"编辑"开始记录...';
            contentDiv.classList.add('empty');
        }
    }

    /**
     * 获取当前年份和周次
     */
    getCurrentWeekInfo() {
        // 从课表管理器获取当前周次信息
        if (window.scheduleManager) {
            const currentWeek = window.scheduleManager.currentWeek;
            const currentYear = new Date().getFullYear();
            return { year: currentYear, week: currentWeek };
        }
        
        // 默认值
        const now = new Date();
        const year = now.getFullYear();
        const week = DateUtils.getWeekNumber(now);
        return { year, week };
    }
}

// 初始化随手记管理器
document.addEventListener('DOMContentLoaded', () => {
    window.weeklyNotesManager = new WeeklyNotesManager();
}); 