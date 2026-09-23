#!/usr/bin/env node
/**
 * Convert all Simplified Chinese characters to Traditional Chinese (Hong Kong standard)
 * in zh-HK.json
 */

const fs = require('fs');
const path = require('path');

// Comprehensive map of Simplified → Traditional (Hong Kong standard)
const SIMPLIFIED_TO_TRADITIONAL = {
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
  '实': '實',
  '馆': '館',
  '开': '開',
  '区': '區',
  '现': '現',
  '显': '顯',
  '报': '報',
  '务': '務',
  '专': '專',
  '业': '業',
  '团': '團',
  '队': '隊',
  '员': '員',
  '须': '須',
  '听': '聽',
  '节': '節',
  '层': '層',
  '钟': '鐘',
  '针': '針',
  '鉴': '鑑',
  '签': '簽',
  '议': '議',
  '审': '審',
  '查': '查',
  '检': '檢',
  '导': '導',
  '师': '師',
  '课': '課',
  '费': '費',
  '币': '幣',
  '图': '圖',
  '库': '庫',
  '应': '應',
  '该': '該',
  '标': '標',
  '准': '準',
  '备': '備',
  '注': '註',
  '册': '冊',
  '纪': '紀',
  '录': '錄',
  '样': '樣',
  '机': '機',
  '构': '構',
  '战': '戰',
  '胜': '勝',
  '败': '敗',
  '负': '負',
  '责': '責',
  '任': '任',
  '产': '產',
  '则': '則',
  '规': '規',
  '范': '範',
  '围': '圍',
  '湾': '灣',
  '台': '臺',
  '务': '務'
};

const zhHKPath = path.join(__dirname, '../messages/zh-HK.json');
let content = fs.readFileSync(zhHKPath, 'utf-8');

let replacementCount = 0;
const replacements = {};

// Replace all Simplified characters with Traditional
for (const [simplified, traditional] of Object.entries(SIMPLIFIED_TO_TRADITIONAL)) {
  const regex = new RegExp(simplified, 'g');
  const matches = content.match(regex);
  if (matches) {
    replacements[simplified] = matches.length;
    replacementCount += matches.length;
    content = content.replace(regex, traditional);
  }
}

// Write back
fs.writeFileSync(zhHKPath, content, 'utf-8');

console.log('✅ Conversion complete!');
console.log(`\nReplaced ${replacementCount} Simplified characters with Traditional equivalents:\n`);

Object.entries(replacements)
  .sort((a, b) => b[1] - a[1])
  .forEach(([simplified, count]) => {
    const traditional = SIMPLIFIED_TO_TRADITIONAL[simplified];
    console.log(`  ${simplified} → ${traditional} (${count} times)`);
  });

console.log(`\nFile updated: ${zhHKPath}`);
