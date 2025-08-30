// API配置文件
const API_CONFIG = {
    // 后端服务器地址
    BASE_URL: 'http://172.16.201.81:301',
    
    // API端点
    ENDPOINTS: {
        // 管理员认证
        ADMIN_LOGIN: '/api/admin/login',
        ADMIN_LOGOUT: '/api/admin/logout',
        ADMIN_STATUS: '/api/admin/status',
        
        // 学期管理
        SEMESTERS: '/api/semesters',
        
        // 课程表管理
        SCHEDULES: '/api/schedules',
        
        // 教师管理
        TEACHERS: '/api/teachers',
        
        // 课程管理
        COURSES: '/api/courses',
        
        // 特需托管
        SPECIAL_CARE: '/api/special-care',
        
        // 任务管理
        TASKS: '/api/tasks',
        
        // 随手记
        NOTES: '/api/notes'
    },
    
    // 请求配置
    REQUEST_CONFIG: {
        credentials: 'include', // 包含cookies用于session
        headers: {
            'Content-Type': 'application/json'
        }
    }
};

// 导出配置
window.API_CONFIG = API_CONFIG; 