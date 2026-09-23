#!/usr/bin/env node
/**
 * Scan zh-HK.json for Simplified Chinese characters that should be Traditional.
 * Reports line numbers and context for each occurrence.
 */

const fs = require('fs');
const path = require('path');

// Map of Simplified → Traditional (Hong Kong standard)
const SIMPLIFIED_TO_TRADITIONAL = {
  // Common characters from the requirements + additional discovered
  '页': '頁',
  '预': '預',
  '场': '場',
  '关': '關',
  '会': '會',
  '属': '屬',
  '于': '於',
  '无': '無',
  '烟': '煙',
  '扰': '擾',
  '网': '網',
  '为': '為',
  '说': '說',
  '这': '這',
  '从': '從',
  '来': '來',
  '没': '沒',
  '价': '價',
  '余': '餘',
  '号': '號',
  '码': '碼',
  '数': '數',
  '过': '過',
  '尝': '嘗',
  '试': '試',
  '录': '錄',
  '时': '時',
  '间': '間',
  '发': '發',
  '传': '傳',
  '验': '驗',
  '继': '繼',
  '续': '續',
  '帐': '帳',
  '设': '設',
  '权': '權',
  '护': '護',
  '启': '啟',
  '进': '進',
  '问': '問',
  '题': '題',
  '绑': '綁',
  '连': '連',
  '获': '獲',
  '错': '錯',
  '链': '鏈',
  '欢': '歡',
  '迎': '迎',
  '独': '獨',
  '编': '編',
  '确': '確',
  '认': '認',
  '选': '選',
  '择': '擇',
  '际': '際',
  '写': '寫',
  '读': '讀',
  '许': '許',
  '载': '載',
  '类': '類',
  '历': '歷',
  '复': '復',
  '单': '單',
  '办': '辦',
  '处': '處',
  '变': '變',
  '换': '換',
  '请': '請',
  '输': '輸',
  '应': '應',
  '该': '該',
  '当': '當',
  '刚': '剛',
  '经': '經',
  '状': '狀',
  '态': '態',
  '购': '購',
  '买': '買',
  '订': '訂',
  '订': '訂',
  '实': '實',
  '际': '際',
  '馆': '館',
  '开': '開',
  '区': '區',
  '现': '現',
  '显': '顯',
  '示': '示',
  '报': '報',
  '务': '務',
  '专': '專',
  '业': '業',
  '团': '團',
  '队': '隊',
  '员': '員',
  '须': '須',
  '须': '須',
  '须': '須',
  '须': '須'
};

const zhHKPath = path.join(__dirname, '../messages/zh-HK.json');
const content = fs.readFileSync(zhHKPath, 'utf-8');
const lines = content.split('\n');

const findings = [];

lines.forEach((line, index) => {
  const lineNum = index + 1;
  const simplifiedChars = [];

  for (const [simplified, traditional] of Object.entries(SIMPLIFIED_TO_TRADITIONAL)) {
    if (line.includes(simplified)) {
      simplifiedChars.push({ simplified, traditional, positions: [] });

      // Find all occurrences
      let pos = 0;
      while ((pos = line.indexOf(simplified, pos)) !== -1) {
        simplifiedChars[simplifiedChars.length - 1].positions.push(pos);
        pos += 1;
      }
    }
  }

  if (simplifiedChars.length > 0) {
    findings.push({
      line: lineNum,
      content: line.trim(),
      chars: simplifiedChars
    });
  }
});

console.log(`Found ${findings.length} lines with Simplified Chinese characters in zh-HK.json\n`);

findings.forEach(({ line, content, chars }) => {
  console.log(`Line ${line}:`);
  console.log(`  ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
  chars.forEach(({ simplified, traditional, positions }) => {
    console.log(`  → "${simplified}" should be "${traditional}" (${positions.length} occurrence${positions.length > 1 ? 's' : ''})`);
  });
  console.log('');
});

console.log(`\nTotal: ${findings.length} lines need correction`);
process.exit(findings.length > 0 ? 1 : 0);
