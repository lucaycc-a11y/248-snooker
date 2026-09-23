#!/usr/bin/env node
/**
 * CI Guard: Ensure zh-HK.json contains only Traditional Chinese characters.
 * Fails if any common Simplified-only characters are detected.
 *
 * This is a tripwire, not an exhaustive converter — it catches the most
 * common Simplified characters that should never appear in Traditional text.
 */

const fs = require('fs');
const path = require('path');

// Common Simplified-only characters that should NEVER appear in Traditional Chinese (Hong Kong)
// This is a focused list for detection, not a complete conversion table
// Note: Characters like 查, 任, 注, 册 are the same in both Simplified and Traditional, so excluded
const FORBIDDEN_SIMPLIFIED = [
  '页', '预', '场', '关', '会', '属', '于', '无', '烟', '扰',
  '网', '为', '说', '这', '从', '来', '没', '价', '余', '号',
  '码', '数', '过', '尝', '试', '时', '间', '发', '传', '验',
  '继', '续', '设', '权', '启', '进', '问', '题', '绑', '连',
  '获', '错', '链', '欢', '独', '编', '确', '认', '选', '择',
  '际', '写', '读', '许', '载', '类', '历', '复', '单', '办',
  '处', '变', '换', '请', '输', '应', '该', '当', '刚', '经',
  '状', '态', '购', '买', '订', '实', '馆', '开', '区', '现',
  '显', '报', '务', '专', '业', '团', '队', '员', '须', '听',
  '节', '层', '钟', '针', '鉴', '签', '议', '审', '检',
  '导', '师', '课', '费', '币', '图', '库', '标', '准', '备',
  '纪', '录', '样', '机', '构', '战', '胜', '败',
  '负', '责', '产', '则', '规', '范', '围', '湾', '台'
];

const zhHKPath = path.join(__dirname, '../messages/zh-HK.json');

if (!fs.existsSync(zhHKPath)) {
  console.error('❌ Error: zh-HK.json not found at', zhHKPath);
  process.exit(1);
}

const content = fs.readFileSync(zhHKPath, 'utf-8');
const lines = content.split('\n');

const violations = [];

lines.forEach((line, index) => {
  const lineNum = index + 1;
  const foundChars = [];

  FORBIDDEN_SIMPLIFIED.forEach(char => {
    if (line.includes(char)) {
      foundChars.push(char);
    }
  });

  if (foundChars.length > 0) {
    violations.push({
      line: lineNum,
      content: line.trim(),
      chars: foundChars
    });
  }
});

if (violations.length === 0) {
  console.log('✅ zh-HK.json: No Simplified Chinese characters detected');
  process.exit(0);
}

console.error('❌ FAIL: zh-HK.json contains Simplified Chinese characters\n');
console.error(`Found ${violations.length} line(s) with Simplified characters:\n`);

violations.slice(0, 10).forEach(({ line, content, chars }) => {
  console.error(`Line ${line}:`);
  console.error(`  ${content.substring(0, 80)}${content.length > 80 ? '...' : ''}`);
  console.error(`  → Contains: ${chars.join(', ')}`);
  console.error('');
});

if (violations.length > 10) {
  console.error(`... and ${violations.length - 10} more line(s)\n`);
}

console.error('\n💡 Fix: Run `node scripts/convert-zh-hk-to-traditional.js` to convert to Traditional Chinese\n');

process.exit(1);
