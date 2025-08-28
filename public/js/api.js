// API调用封装

/**
 * 基础API客户端
 */
class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * 发送HTTP请求
     * @param {string} url 请求URL
     * @param {Object} options 请求选项
     */
    async request(url, options = {}) {
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        console.log('API请求详情:', {
            url: this.baseUrl + url,
            method: config.method || 'GET',
            headers: config.headers,
            body: config.body
        });

        try {
            const response = await fetch(this.baseUrl + url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    /**
     * GET请求
     * @param {string} url 请求URL
     * @param {Object} headers 请求头
     */
    async get(url, headers = {}) {
        return this.request(url, {
            method: 'GET',
            headers
        });
    }

    /**
     * POST请求
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} headers 请求头
     */
    async post(url, data = {}, headers = {}) {
        return this.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT请求
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} headers 请求头
     */
    async put(url, data = {}, headers = {}) {
        return this.request(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE请求
     * @param {string} url 请求URL
     * @param {Object} headers 请求头
     */
    async delete(url, headers = {}) {
        return this.request(url, {
            method: 'DELETE',
            headers
        });
    }
}

// 创建API客户端实例
const apiClient = new ApiClient('/api');

/**
 * 教师API
 */
const TeacherAPI = {
    /**
     * 获取所有教师
     */
    async getAll() {
        return apiClient.get('/teachers');
    },

    /**
     * 创建教师
     * @param {Object} teacherData 教师数据
     */
    async create(teacherData) {
        return apiClient.post('/teachers', teacherData);
    },

    /**
     * 更新教师信息
     * @param {number} id 教师ID
     * @param {Object} teacherData 教师数据
     */
    async update(id, teacherData) {
        return apiClient.put(`/teachers/${id}`, teacherData);
    },

    /**
     * 删除教师
     * @param {number} id 教师ID
     */
    async delete(id) {
        return apiClient.delete(`/teachers/${id}`);
    }
};

/**
 * 课程表API
 */
const ScheduleAPI = {
    /**
     * 获取教师的课程表
     * @param {number} teacherId 教师ID
     */
    async getByTeacher(teacherId) {
        return apiClient.get(`/schedules/teacher/${teacherId}`);
    },

    /**
     * 获取指定周的课程表
     * @param {number} scheduleId 课程表ID
     * @param {number} week 周次
     */
    async getWeekSchedule(scheduleId, week) {
        return apiClient.get(`/schedules/${scheduleId}/week/${week}`);
    },

    /**
     * 创建课程表
     * @param {Object} scheduleData 课程表数据
     */
    async create(scheduleData) {
        return apiClient.post('/schedules', scheduleData);
    },

    /**
     * 更新课程表
     * @param {number} id 课程表ID
     * @param {Object} scheduleData 课程表数据
     */
    async update(id, scheduleData) {
        return apiClient.put(`/schedules/${id}`, scheduleData);
    },

    /**
     * 保存为原始课程表
     * @param {number} scheduleId 课程表ID
     */
    async saveOriginal(scheduleId) {
        return apiClient.post(`/schedules/${scheduleId}/save-original`);
    },

    /**
     * 复位到原始课程表
     * @param {number} scheduleId 课程表ID
     */
    async reset(scheduleId) {
        return apiClient.post(`/schedules/${scheduleId}/reset`);
    },

    /**
     * 获取原始课程表数据
     * @param {number} scheduleId 课程表ID
     */
    async getOriginalCourses(scheduleId) {
        return apiClient.get(`/schedules/${scheduleId}/original`);
    }
};

/**
 * 课程API
 */
const CourseAPI = {
    /**
     * 添加课程
     * @param {Object} courseData 课程数据
     */
    async create(courseData) {
        return apiClient.post('/courses', courseData);
    },

    /**
     * 移动课程位置
     * @param {number} id 课程ID
     * @param {Object} moveData 移动数据
     */
    async move(id, moveData) {
        return apiClient.put(`/courses/${id}/move`, moveData);
    },

    /**
     * 删除课程
     * @param {number} id 课程ID
     */
    async delete(id) {
        return apiClient.delete(`/courses/${id}`);
    },

    /**
     * 批量更新课程
     * @param {Array} courses 课程数组
     */
    async batchUpdate(courses) {
        return apiClient.post('/courses/batch-update', { courses });
    }
};

/**
 * 特需托管API
 */
const SpecialCareAPI = {
    /**
     * 获取课程表的特需托管列表
     * @param {number} scheduleId 课程表ID
     */
    async getBySchedule(scheduleId) {
        return apiClient.get(`/special-care/schedule/${scheduleId}`);
    },

    /**
     * 添加特需托管
     * @param {Object} specialCareData 特需托管数据
     */
    async create(specialCareData) {
        return apiClient.post('/special-care', specialCareData);
    },

    /**
     * 更新特需托管
     * @param {number} id 特需托管ID
     * @param {Object} specialCareData 特需托管数据
     */
    async update(id, specialCareData) {
        return apiClient.put(`/special-care/${id}`, specialCareData);
    },

    /**
     * 删除特需托管
     * @param {number} id 特需托管ID
     */
    async delete(id) {
        return apiClient.delete(`/special-care/${id}`);
    }
};

/**
 * 日历API
 */
const CalendarAPI = {
    /**
     * 获取当前学期信息
     */
    async getCurrentSemester() {
        return apiClient.get('/calendar/semester/current');
    },

    /**
     * 创建学期
     * @param {Object} semesterData 学期数据
     */
    async createSemester(semesterData) {
        return apiClient.post('/calendar/semester', semesterData);
    },

    /**
     * 获取指定周的特需托管
     * @param {number} week 周次
     */
    async getWeekSpecialCare(week) {
        return apiClient.get(`/calendar/week/${week}/special-care`);
    }
};

/**
 * API错误处理包装器
 * @param {Function} apiFunc API函数
 * @param {Object} options 选项
 */
async function withErrorHandling(apiFunc, options = {}) {
    const { 
        showLoading = true, 
        showSuccess = false, 
        showError = true,
        successMessage = '操作成功',
        loadingMessage = '加载中...'
    } = options;

    try {
        if (showLoading) {
            LoadingUtils.show(loadingMessage);
        }

        const result = await apiFunc();

        if (showSuccess) {
            NotificationUtils.success(successMessage);
        }

        return result;
    } catch (error) {
        if (showError) {
            NotificationUtils.error(error.message || '操作失败');
        }
        throw error;
    } finally {
        if (showLoading) {
            LoadingUtils.hide();
        }
    }
}

/**
 * 加载工具
 */
const LoadingUtils = {
    /**
     * 显示加载指示器
     * @param {string} message 加载消息
     */
    show(message = '加载中...') {
        let loadingElement = DOMUtils.$('#loading-indicator');
        if (!loadingElement) {
            loadingElement = DOMUtils.createElement('div', {
                id: 'loading-indicator',
                className: 'loading-indicator'
            });
            
            const spinner = DOMUtils.createElement('div', {
                className: 'spinner'
            });
            
            const text = DOMUtils.createElement('p', {}, message);
            
            loadingElement.appendChild(spinner);
            loadingElement.appendChild(text);
            document.body.appendChild(loadingElement);
        } else {
            const text = DOMUtils.$('p', loadingElement);
            if (text) text.textContent = message;
        }
        
        DOMUtils.show(loadingElement);
    },

    /**
     * 隐藏加载指示器
     */
    hide() {
        const loadingElement = DOMUtils.$('#loading-indicator');
        if (loadingElement) {
            DOMUtils.hide(loadingElement);
        }
    }
};

/**
 * 数据缓存管理
 */
class DataCache {
    constructor() {
        this.cache = new Map();
        this.expiry = new Map();
    }

    /**
     * 设置缓存
     * @param {string} key 键
     * @param {*} value 值
     * @param {number} ttl 过期时间(毫秒)
     */
    set(key, value, ttl = 5 * 60 * 1000) { // 默认5分钟
        this.cache.set(key, value);
        this.expiry.set(key, Date.now() + ttl);
    }

    /**
     * 获取缓存
     * @param {string} key 键
     */
    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }

        const expireTime = this.expiry.get(key);
        if (Date.now() > expireTime) {
            this.delete(key);
            return null;
        }

        return this.cache.get(key);
    }

    /**
     * 删除缓存
     * @param {string} key 键
     */
    delete(key) {
        this.cache.delete(key);
        this.expiry.delete(key);
    }

    /**
     * 清空缓存
     */
    clear() {
        this.cache.clear();
        this.expiry.clear();
    }

    /**
     * 检查是否存在
     * @param {string} key 键
     */
    has(key) {
        return this.get(key) !== null;
    }
}

// 创建数据缓存实例
const dataCache = new DataCache();

/**
 * 带缓存的API调用
 * @param {string} cacheKey 缓存键
 * @param {Function} apiFunc API函数
 * @param {number} ttl 缓存时间
 */
async function cachedApiCall(cacheKey, apiFunc, ttl = 5 * 60 * 1000) {
    // 尝试从缓存获取
    const cached = dataCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // 调用API并缓存结果
    const result = await apiFunc();
    dataCache.set(cacheKey, result, ttl);
    
    return result;
}

/**
 * 清除相关缓存
 * @param {string} pattern 缓存键模式
 */
function clearRelatedCache(pattern) {
    const keys = Array.from(dataCache.cache.keys());
    keys.forEach(key => {
        if (key.includes(pattern)) {
            dataCache.delete(key);
        }
    });
}

/**
 * 重试机制
 * @param {Function} func 函数
 * @param {number} maxRetries 最大重试次数
 * @param {number} delay 延迟时间
 */
async function retry(func, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await func();
        } catch (error) {
            lastError = error;
            
            if (i === maxRetries) {
                throw lastError;
            }
            
            // 指数退避
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
}

/**
 * 批量API调用
 * @param {Array} apiCalls API调用数组
 * @param {number} concurrency 并发数
 */
async function batchApiCall(apiCalls, concurrency = 5) {
    const results = [];
    
    for (let i = 0; i < apiCalls.length; i += concurrency) {
        const batch = apiCalls.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(batch);
        results.push(...batchResults);
    }
    
    return results;
}

/**
 * 任务管理API
 */
const TaskAPI = {
    /**
     * 获取课程相关任务
     */
    async getCourseTask(scheduleId, weekday, timeSlot) {
        return await apiClient.get(`/tasks/course/${scheduleId}/${weekday}/${timeSlot}`);
    },

    /**
     * 获取教师任务
     */
    async getTeacherTasks(teacherId, filters = {}) {
        const params = new URLSearchParams();
        if (filters.date) params.append('date', filters.date);
        if (filters.status) params.append('status', filters.status);
        if (filters.type) params.append('type', filters.type);
        
        const url = `/tasks/teacher/${teacherId}${params.toString() ? '?' + params.toString() : ''}`;
        return await apiClient.get(url);
    },

    /**
     * 获取教师的所有任务（简化版）
     */
    async getByTeacher(teacherId) {
        return await this.getTeacherTasks(teacherId);
    },

    /**
     * 创建任务
     */
    async create(taskData) {
        return await apiClient.post('/tasks', taskData);
    },

    /**
     * 更新任务
     */
    async update(id, taskData) {
        return await apiClient.put(`/tasks/${id}`, taskData);
    },

    /**
     * 删除任务
     */
    async delete(id) {
        return await apiClient.delete(`/tasks/${id}`);
    },

    /**
     * 标记任务完成
     */
    async complete(id) {
        return await this.update(id, { status: 'completed' });
    },

    /**
     * 获取任务统计
     */
    async getStats(teacherId, date) {
        const tasks = await this.getTeacherTasks(teacherId, { date });
        const stats = {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            high: tasks.filter(t => t.priority_level === 'high').length
        };
        return stats;
    }
};

// 随手记API
const WeeklyNotesAPI = {
    /**
     * 获取随手记
     */
    async get(teacherId, scheduleId, year, week) {
        return await apiClient.get(`/weekly-notes/${teacherId}/${scheduleId}/${year}/${week}`);
    },

    /**
     * 保存随手记
     */
    async save(teacherId, scheduleId, year, weekNumber, content) {
        return await apiClient.post('/weekly-notes', {
            teacherId,
            scheduleId,
            year,
            weekNumber,
            content
        });
    }
};

// 导出API对象
window.API = {
    Teacher: TeacherAPI,
    Schedule: ScheduleAPI,
    Course: CourseAPI,
    SpecialCare: SpecialCareAPI,
    Calendar: CalendarAPI,
    Task: TaskAPI,
    WeeklyNotes: WeeklyNotesAPI
};

// 导出工具函数
window.APIUtils = {
    withErrorHandling,
    LoadingUtils,
    dataCache,
    cachedApiCall,
    clearRelatedCache,
    retry,
    batchApiCall
}; 