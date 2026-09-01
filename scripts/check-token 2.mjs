#!/usr/bin/env node
const token = process.env.SUPABASE_ACCESS_TOKEN;
console.log(token ? 'TOKEN_SET' : 'NO_TOKEN');