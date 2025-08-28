/**
 * Toast提示系统
 */
class ToastManager {
    constructor() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * 显示toast
     * @param {string} message - 消息内容
     * @param {string} type - 类型: success, error, warning, info
     * @param {string} title - 标题（可选）
     * @param {number} duration - 显示时长（毫秒），0表示不自动关闭
     */
    show(message, type = 'info', title = null, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconEl = document.createElement('div');
        iconEl.className = 'toast-icon';
        
        const contentEl = document.createElement('div');
        contentEl.className = 'toast-content';
        
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            contentEl.appendChild(titleEl);
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        contentEl.appendChild(messageEl);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.remove(toast);
        
        toast.appendChild(iconEl);
        toast.appendChild(contentEl);
        toast.appendChild(closeBtn);
        
        this.container.appendChild(toast);
        
        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                this.remove(toast);
            }, duration);
        }
        
        return toast;
    }

    /**
     * 移除toast
     */
    remove(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }

    /**
     * 显示成功消息
     */
    success(message, title = null, duration = 3000) {
        return this.show(message, 'success', title, duration);
    }

    /**
     * 显示错误消息
     */
    error(message, title = null, duration = 5000) {
        return this.show(message, 'error', title, duration);
    }

    /**
     * 显示警告消息
     */
    warning(message, title = null, duration = 4000) {
        return this.show(message, 'warning', title, duration);
    }

    /**
     * 显示信息消息
     */
    info(message, title = null, duration = 3000) {
        return this.show(message, 'info', title, duration);
    }

    /**
     * 清除所有toast
     */
    clear() {
        const toasts = this.container.querySelectorAll('.toast');
        toasts.forEach(toast => this.remove(toast));
    }
}

// 创建全局实例
window.Toast = new ToastManager();

// 为了兼容性，也提供一些全局函数
window.showToast = (message, type, title, duration) => {
    return window.Toast.show(message, type, title, duration);
};

window.showSuccess = (message, title, duration) => {
    return window.Toast.success(message, title, duration);
};

window.showError = (message, title, duration) => {
    return window.Toast.error(message, title, duration);
};

window.showWarning = (message, title, duration) => {
    return window.Toast.warning(message, title, duration);
};

window.showInfo = (message, title, duration) => {
    return window.Toast.info(message, title, duration);
}; 