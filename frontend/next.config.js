const path = require("path");

// Load .env from repo root when app is in frontend/
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
