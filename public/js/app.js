// 主应用控制器

/**
 * 主应用类
 */
class ScheduleApp {
    constructor() {
        this.scheduleManager = null;
        this.dragDropManager = null;
        this.calendarManager = null;
        this.isInitialized = false;
    }

    /**
     * 初始化应用
     */
    async init() {
        if (this.isInitialized) return;

        try {
            console.log('正在初始化课程表应用...');

            // 初始化课程表管理器
            this.scheduleManager = new ScheduleManager();
            window.scheduleManager = this.scheduleManager; // 设置为全局变量
            
            // 初始化拖拽管理器
            if (window.DragDropManager) {
                this.dragDropManager = new DragDropManager(this.scheduleManager);
            }

            // 初始化日历管理器
            if (window.CalendarManager) {
                this.calendarManager = new CalendarManager(this.scheduleManager);
                window.calendarManager = this.calendarManager;
            }

            // 绑定全局事件
            this.bindGlobalEvents();

            // 初始化布局调整 - 多次调用确保布局正确
            setTimeout(() => {
                this.adjustRightPanelHeight();
            }, 100);
            
            setTimeout(() => {
                this.adjustRightPanelHeight();
            }, 500);
            
            setTimeout(() => {
                this.adjustRightPanelHeight();
            }, 1000);

            this.isInitialized = true;
            console.log('课程表应用初始化完成');

        } catch (error) {
            console.error('应用初始化失败:', error);
            NotificationUtils.error('应用初始化失败，请刷新页面重试');
        }
    }

    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // 页面加载完成事件
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM加载完成');
        });

        // 页面可见性变化事件
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.scheduleManager) {
                // 页面重新可见时，可以刷新数据
                console.log('页面重新可见');
            }
        });

        // 全局错误处理
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
        });

        // 全局未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
        });

        // 管理员按钮
        const adminBtn = DOMUtils.$('#admin-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                window.open('/admin.html', '_blank');
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });

        // 窗口大小调整
        window.addEventListener('resize', debounce(() => {
            this.handleWindowResize();
        }, 250));
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboardShortcuts(event) {
        // Ctrl+S 保存
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            if (this.scheduleManager) {
                this.scheduleManager.saveSchedule();
            }
        }

        // Ctrl+Z 撤销/复位
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            if (this.scheduleManager) {
                this.scheduleManager.resetSchedule();
            }
        }

        // 左右箭头切换周次
        if (event.altKey) {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                if (this.scheduleManager) {
                    this.scheduleManager.changeWeek(-1);
                }
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                if (this.scheduleManager) {
                    this.scheduleManager.changeWeek(1);
                }
            }
        }

        // ESC 关闭模态框
        if (event.key === 'Escape') {
            const modals = DOMUtils.$$('.modal-overlay:not([style*="display: none"])');
            modals.forEach(modal => {
                DOMUtils.hide(modal);
            });
        }
    }

    /**
     * 处理窗口大小调整
     */
    handleWindowResize() {
        // 可以在这里处理响应式布局调整
        console.log('窗口大小调整');
        this.adjustRightPanelHeight();
    }

    /**
     * 调整右侧面板高度与左侧区域对齐
     */
    adjustRightPanelHeight() {
        try {
            const leftMainArea = document.querySelector('.left-main-area');
            const rightPanel = document.querySelector('.right-panel');
            const todoSection = document.querySelector('.right-panel .panel-section:last-child');
            
            if (!leftMainArea || !rightPanel || !todoSection) {
                console.log('布局调整失败：无法找到必要的DOM元素', {
                    leftMainArea: !!leftMainArea,
                    rightPanel: !!rightPanel,
                    todoSection: !!todoSection
                });
                return;
            }

            // 等待DOM完全渲染
            setTimeout(() => {
                // 计算左侧区域的总高度
                const leftAreaHeight = leftMainArea.offsetHeight;
                
                // 计算右侧面板中课程详情部分的高度
                const courseDetailSection = document.querySelector('.right-panel .panel-section:first-child');
                const courseDetailHeight = courseDetailSection ? courseDetailSection.offsetHeight : 0;
                
                // 计算待办事项区域应该的高度（左侧高度 - 课程详情高度 - 边框间距）
                const todoAreaHeight = Math.max(400, leftAreaHeight - courseDetailHeight - 2);
                
                // 设置待办事项区域固定高度，确保始终与随手记对齐
                todoSection.style.height = `${todoAreaHeight}px`;
                todoSection.style.maxHeight = `${todoAreaHeight}px`;
                todoSection.style.minHeight = `${todoAreaHeight}px`;
                
                // 确保待办事项列表能够显示滚动条
                const todoList = document.querySelector('.todo-list');
                if (todoList) {
                    const listMaxHeight = Math.max(200, todoAreaHeight - 100); // 减去标题和tab按钮的高度，最小200px
                    todoList.style.height = `${listMaxHeight}px`;
                    todoList.style.maxHeight = `${listMaxHeight}px`;
                    todoList.style.minHeight = `${listMaxHeight}px`;
                }
                
                console.log(`✅ 布局调整完成: 左侧=${leftAreaHeight}px, 课程详情=${courseDetailHeight}px, 待办事项=${todoAreaHeight}px`);
                
            }, 100);
            
        } catch (error) {
            console.error('调整右侧面板高度失败:', error);
        }
    }

    /**
     * 获取应用状态
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            currentTeacher: this.scheduleManager?.currentTeacher,
            currentWeek: this.scheduleManager?.currentWeek,
            currentSchedule: this.scheduleManager?.currentSchedule
        };
    }
}

/**
 * 应用工具函数
 */
const AppUtils = {
    /**
     * 格式化时间显示
     */
    formatTimeSlot(timeSlot) {
        const slots = {
            1: '上午第1节',
            2: '上午第2节', 
            3: '上午第3节',
            4: '午间管理',
            5: '下午第1节',
            6: '下午第2节',
            7: '下午第3节',
            8: '晚托',
            9: '特需托管'
        };
        return slots[timeSlot] || `第${timeSlot}节`;
    },

    /**
     * 格式化星期显示
     */
    formatWeekday(weekday) {
        const days = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        return days[weekday] || `星期${weekday}`;
    },

    /**
     * 检查时间冲突
     */
    checkTimeConflict(courses, newCourse) {
        return courses.some(course => 
            course.weekday === newCourse.weekday && 
            course.time_slot === newCourse.time_slot &&
            course.id !== newCourse.id
        );
    },

    /**
     * 获取课程统计信息
     */
    getCourseStats(courses) {
        const stats = {
            total: courses.length,
            byTimeSlot: {},
            byWeekday: {},
            bySubject: {}
        };

        courses.forEach(course => {
            // 按时间段统计
            stats.byTimeSlot[course.time_slot] = (stats.byTimeSlot[course.time_slot] || 0) + 1;
            
            // 按星期统计
            stats.byWeekday[course.weekday] = (stats.byWeekday[course.weekday] || 0) + 1;
            
            // 按科目统计
            const subject = course.course_name.split(' ')[0]; // 简单提取科目名
            stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;
        });

        return stats;
    }
};

/**
 * 页面加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 显示加载指示器
    const loadingElement = DOMUtils.$('#loading-indicator');
    if (loadingElement) {
        DOMUtils.show(loadingElement);
    }

    try {
        // 创建应用实例
        window.app = new ScheduleApp();
        
        // 初始化应用
        await window.app.init();
        
        // 添加任务表单事件监听器（已改为按钮onclick处理）
        // DOMUtils.on('#task-form', 'submit', (e) => {
        //     if (window.scheduleManager) {
        //         window.scheduleManager.handleTaskFormSubmit(e);
        //     }
        // });
        
        // 全局任务提交处理函数
        window.handleTaskSubmit = function(event) {
            console.log('全局任务提交函数被调用');
            console.log('window.scheduleManager 存在:', !!window.scheduleManager);
            
            if (event && event.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            if (window.scheduleManager && typeof window.scheduleManager.handleTaskFormSubmit === 'function') {
                try {
                    window.scheduleManager.handleTaskFormSubmit(event);
                } catch (error) {
                    console.error('调用 handleTaskFormSubmit 失败:', error);
                    alert('保存任务失败: ' + error.message);
                }
            } else {
                console.error('scheduleManager 未初始化或方法不存在');
                console.log('window.scheduleManager:', window.scheduleManager);
                alert('系统未完全加载，请刷新页面后重试');
            }
        };
        
        // 显示欢迎信息
        setTimeout(() => {
            NotificationUtils.success('课程表系统加载完成');
        }, 1000);

    } catch (error) {
        console.error('应用启动失败:', error);
        NotificationUtils.error('系统启动失败，请刷新页面重试');
    } finally {
        // 隐藏加载指示器
        if (loadingElement) {
            setTimeout(() => {
                DOMUtils.hide(loadingElement);
            }, 800);
        }
    }
});

// 导出工具函数
window.AppUtils = AppUtils; 