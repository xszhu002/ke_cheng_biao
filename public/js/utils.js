// 工具函数库

/**
 * 日期工具函数
 */
const DateUtils = {
    /**
     * 获取北京时间
     */
    getBeijingTime() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const beijingTime = new Date(utc + (8 * 3600000));
        return beijingTime;
    },

    /**
     * 格式化日期
     * @param {Date} date 日期对象
     * @param {string} format 格式字符串，如 'YYYY-MM-DD'
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },

    /**
     * 解析日期字符串
     * @param {string} dateString 日期字符串
     */
    parseDate(dateString) {
        if (!dateString) return null;
        return new Date(dateString);
    },

    /**
     * 计算周次
     * @param {Date} startDate 学期开始日期
     * @param {Date} currentDate 当前日期
     */
    calculateWeekNumber(startDate, currentDate = null) {
        if (!startDate) return 1;
        
        const current = currentDate || this.getBeijingTime();
        const diffTime = current.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, Math.ceil(diffDays / 7));
    },

    /**
     * 获取指定周的日期范围
     * @param {Date} startDate 学期开始日期
     * @param {number} weekNumber 周次
     */
    getWeekDateRange(startDate, weekNumber) {
        if (!startDate || !weekNumber) return null;

        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (weekNumber - 1) * 7);
        
        // 调整到周一
        const dayOfWeek = weekStart.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        weekStart.setDate(weekStart.getDate() + diff);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 4); // 周五
        
        return {
            start: weekStart,
            end: weekEnd,
            startStr: this.formatDate(weekStart),
            endStr: this.formatDate(weekEnd)
        };
    },

    /**
     * 获取月份的所有日期
     * @param {number} year 年份
     * @param {number} month 月份 (0-11)
     */
    getMonthDates(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // 获取第一周的开始日期（周日）
        const startDate = new Date(firstDay);
        startDate.setDate(firstDay.getDate() - firstDay.getDay());
        
        // 获取最后一周的结束日期（周六）
        const endDate = new Date(lastDay);
        endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
        
        const dates = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        
        return dates;
    }
};

/**
 * DOM 工具函数
 */
const DOMUtils = {
    /**
     * 查询元素
     * @param {string} selector CSS选择器
     * @param {Element} parent 父元素
     */
    $(selector, parent = document) {
        return parent.querySelector(selector);
    },

    /**
     * 查询所有元素
     * @param {string} selector CSS选择器
     * @param {Element} parent 父元素
     */
    $$(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    },

    /**
     * 创建元素
     * @param {string} tagName 标签名
     * @param {Object} attributes 属性对象
     * @param {string} textContent 文本内容
     */
    createElement(tagName, attributes = {}, textContent = '') {
        const element = document.createElement(tagName);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (textContent) {
            element.textContent = textContent;
        }
        
        return element;
    },

    /**
     * 添加事件监听器
     * @param {Element|string} element 元素或选择器
     * @param {string} event 事件名
     * @param {Function} handler 处理函数
     * @param {Object} options 选项
     */
    on(element, event, handler, options = {}) {
        // 如果传入的是字符串，先获取元素
        if (typeof element === 'string') {
            element = this.$(element);
        }
        
        if (element && typeof element.addEventListener === 'function') {
            element.addEventListener(event, handler, options);
        } else {
            console.warn('DOMUtils.on: 无效的元素', element);
        }
    },

    /**
     * 移除事件监听器
     * @param {Element} element 元素
     * @param {string} event 事件名
     * @param {Function} handler 处理函数
     */
    off(element, event, handler) {
        element.removeEventListener(event, handler);
    },

    /**
     * 切换类名
     * @param {Element} element 元素
     * @param {string} className 类名
     * @param {boolean} force 强制添加或移除
     */
    toggleClass(element, className, force) {
        return element.classList.toggle(className, force);
    },

    /**
     * 显示元素
     * @param {Element} element 元素
     */
    show(element) {
        element.style.display = '';
    },

    /**
     * 隐藏元素
     * @param {Element} element 元素
     */
    hide(element) {
        element.style.display = 'none';
    }
};

/**
 * 字符串工具函数
 */
const StringUtils = {
    /**
     * 转义HTML
     * @param {string} str 字符串
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * 截断字符串
     * @param {string} str 字符串
     * @param {number} length 长度
     * @param {string} suffix 后缀
     */
    truncate(str, length, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + suffix;
    },

    /**
     * 首字母大写
     * @param {string} str 字符串
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * 转换为驼峰命名
     * @param {string} str 字符串
     */
    toCamelCase(str) {
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }
};

/**
 * 数组工具函数
 */
const ArrayUtils = {
    /**
     * 数组去重
     * @param {Array} arr 数组
     * @param {string} key 对象数组的唯一键
     */
    unique(arr, key = null) {
        if (!key) {
            return [...new Set(arr)];
        }
        
        const seen = new Set();
        return arr.filter(item => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    },

    /**
     * 数组分组
     * @param {Array} arr 数组
     * @param {string|Function} key 分组键或函数
     */
    groupBy(arr, key) {
        return arr.reduce((groups, item) => {
            const group = typeof key === 'function' ? key(item) : item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    },

    /**
     * 数组排序
     * @param {Array} arr 数组
     * @param {string|Function} key 排序键或函数
     * @param {boolean} ascending 是否升序
     */
    sortBy(arr, key, ascending = true) {
        const sorted = [...arr].sort((a, b) => {
            const valueA = typeof key === 'function' ? key(a) : a[key];
            const valueB = typeof key === 'function' ? key(b) : b[key];
            
            if (valueA < valueB) return ascending ? -1 : 1;
            if (valueA > valueB) return ascending ? 1 : -1;
            return 0;
        });
        
        return sorted;
    }
};

/**
 * 验证工具函数
 */
const ValidationUtils = {
    /**
     * 验证邮箱
     * @param {string} email 邮箱地址
     */
    isEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    /**
     * 验证手机号
     * @param {string} phone 手机号
     */
    isPhone(phone) {
        const regex = /^1[3-9]\d{9}$/;
        return regex.test(phone);
    },

    /**
     * 验证非空
     * @param {*} value 值
     */
    isRequired(value) {
        return value !== null && value !== undefined && value !== '';
    },

    /**
     * 验证长度
     * @param {string} value 值
     * @param {number} min 最小长度
     * @param {number} max 最大长度
     */
    isLength(value, min, max = Infinity) {
        if (!value) return false;
        const length = value.length;
        return length >= min && length <= max;
    }
};

/**
 * 本地存储工具函数
 */
const StorageUtils = {
    /**
     * 设置本地存储
     * @param {string} key 键
     * @param {*} value 值
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('设置本地存储失败:', error);
        }
    },

    /**
     * 获取本地存储
     * @param {string} key 键
     * @param {*} defaultValue 默认值
     */
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error('获取本地存储失败:', error);
            return defaultValue;
        }
    },

    /**
     * 移除本地存储
     * @param {string} key 键
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('移除本地存储失败:', error);
        }
    },

    /**
     * 清空本地存储
     */
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('清空本地存储失败:', error);
        }
    }
};

/**
 * 通知工具函数
 */
const NotificationUtils = {
    /**
     * 显示通知
     * @param {string} message 消息
     * @param {string} type 类型：success, error, warning, info
     * @param {number} duration 持续时间(毫秒)
     */
    show(message, type = 'info', duration = 3000) {
        // 使用新的Toast系统
        if (window.Toast) {
            return window.Toast.show(message, type, null, duration);
        }
        
        // 后备方案：如果Toast系统未加载，使用原有方式但位置改为右下角
        const notification = DOMUtils.createElement('div', {
            className: `notification notification-${type}`,
            style: `
                position: fixed;
                bottom: 80px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                max-width: 400px;
                word-wrap: break-word;
                animation: slideInRight 0.3s ease;
            `
        }, message);

        // 设置背景色
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // 添加到页面
        document.body.appendChild(notification);

        // 自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }
        }, duration);

        // 点击关闭
        DOMUtils.on(notification, 'click', () => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        });
    },

    /**
     * 显示成功通知
     * @param {string} message 消息
     */
    success(message) {
        this.show(message, 'success');
    },

    /**
     * 显示错误通知
     * @param {string} message 消息
     */
    error(message) {
        this.show(message, 'error');
    },

    /**
     * 显示警告通知
     * @param {string} message 消息
     */
    warning(message) {
        this.show(message, 'warning');
    },

    /**
     * 显示信息通知
     * @param {string} message 消息
     */
    info(message) {
        this.show(message, 'info');
    }
};

/**
 * 防抖函数
 * @param {Function} func 函数
 * @param {number} wait 等待时间
 * @param {boolean} immediate 是否立即执行
 */
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * 节流函数
 * @param {Function} func 函数
 * @param {number} limit 限制时间
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 添加通知动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

/**
 * 简单的Markdown解析器
 */
const MarkdownUtils = {
    /**
     * 解析Markdown文本为HTML
     */
    parse(markdown) {
        if (!markdown) return '';
        
        let html = markdown
            // 转义HTML特殊字符
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            
            // 标题
            .replace(/^### (.*)/gm, '<h3>$1</h3>')
            .replace(/^## (.*)/gm, '<h2>$1</h2>')
            .replace(/^# (.*)/gm, '<h1>$1</h1>')
            
            // 粗体和斜体
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // 代码
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // 分割线
            .replace(/^---$/gm, '<hr>')
            
            // 引用
            .replace(/^> (.*)/gm, '<blockquote>$1</blockquote>')
            
            // 无序列表
            .replace(/^- (.*)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            
            // 有序列表  
            .replace(/^\d+\. (.*)/gm, '<li>$1</li>')
            
            // 段落
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)$/gm, function(match, content) {
                // 避免重复包装已经是HTML标签的内容
                if (content.startsWith('<') || content.trim() === '') {
                    return content;
                }
                return content;
            });
        
        // 包装段落
        html = '<p>' + html + '</p>';
        
        // 清理多余的段落标签
        html = html
            .replace(/<p><h([1-6])>/g, '<h$1>')
            .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
            .replace(/<p><ul>/g, '<ul>')
            .replace(/<\/ul><\/p>/g, '</ul>')
            .replace(/<p><ol>/g, '<ol>')
            .replace(/<\/ol><\/p>/g, '</ol>')
            .replace(/<p><blockquote>/g, '<blockquote>')
            .replace(/<\/blockquote><\/p>/g, '</blockquote>')
            .replace(/<p><hr><\/p>/g, '<hr>')
            .replace(/<p><\/p>/g, '')
            .replace(/^\s*<p>\s*<\/p>\s*$/g, '');
        
        return html;
    }
}; 