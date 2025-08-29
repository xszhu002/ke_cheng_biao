# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine AS base

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 创建生产镜像
FROM node:18-alpine AS production

# 安装必要的系统依赖
RUN apk add --no-cache \
    sqlite \
    python3 \
    make \
    g++

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 设置工作目录
WORKDIR /app

# 从base阶段复制node_modules
COPY --from=base --chown=nextjs:nodejs /app/node_modules ./node_modules

# 复制应用代码
COPY --chown=nextjs:nodejs . .

# 创建数据库目录
RUN mkdir -p database && chown -R nextjs:nodejs database

# 切换到非root用户
USER nextjs

# 初始化数据库
RUN npm run init-db

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: 3000, path: '/', timeout: 2000 }; \
    const request = http.request(options, (res) => { \
        if (res.statusCode === 200) process.exit(0); \
        else process.exit(1); \
    }); \
    request.on('error', () => process.exit(1)); \
    request.end();"

# 启动应用
CMD ["npm", "start"] 