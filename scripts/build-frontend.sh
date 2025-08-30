#!/bin/bash

# 前端构建脚本
echo "开始构建前端文件..."

# 创建构建目录
BUILD_DIR="./frontend-build"
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

# 复制所有前端文件
echo "复制前端文件..."
cp -r public/* $BUILD_DIR/

# 创建压缩包（便于部署）
echo "创建部署包..."
tar -czf kechengbiao-frontend.tar.gz -C $BUILD_DIR .

echo "前端构建完成！"
echo "部署文件位置: $BUILD_DIR/"
echo "压缩包: kechengbiao-frontend.tar.gz"
echo ""
echo "部署命令示例："
echo "# 在172.16.201.191服务器上执行："
echo "tar -xzf kechengbiao-frontend.tar.gz -C /var/www/html/kechengbiao/" 