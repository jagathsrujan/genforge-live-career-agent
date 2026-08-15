/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["playwright", "pdfkit", "docx", "pdf-parse", "mammoth"],
};

export default nextConfig;
