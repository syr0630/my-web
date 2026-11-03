/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 加上这一行，告诉它输出静态网页
  images: {
    unoptimized: true, // 加上这一行，防止图片加载报错
  }
};

export default nextConfig;


