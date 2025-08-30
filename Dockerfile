# 使用官方Node.js 18运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码（只复制后端需要的文件）
COPY server.js ./
COPY database/ ./database/
COPY scripts/ ./scripts/

# 创建数据库目录并设置权限
RUN mkdir -p /app/database && chmod 755 /app/database

# 暴露后端API端口（301）
EXPOSE 301

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=301

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:301/api/admin/check', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 启动应用
CMD ["node", "server.js"] 