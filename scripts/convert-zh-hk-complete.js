#!/usr/bin/env node
/**
 * Complete conversion of all Simplified Chinese to Traditional Chinese (Hong Kong standard)
 * in zh-HK.json. Comprehensive mapping covering all characters found in the audit.
 */

const fs = require('fs');
const path = require('path');

// Comprehensive Simplified → Traditional mapping (Hong Kong standard)
// All unique mappings extracted from audit + previous script
const SIMPLIFIED_TO_TRADITIONAL = {
  // Common characters
  '们': '們', '还': '還', '与': '與', '户': '戶', '转': '轉', '条': '條',
  '绝': '絕', '饮': '飲', '热': '熱', '维': '維', '营': '營', '风': '風',
  '积': '積', '矿': '礦', '邻': '鄰', '铁': '鐵', '钻': '鑽', '爱': '愛',
  '电': '電', '话': '話', '邮': '郵', '证': '證', '跳': '跳', '功': '功',
  '误': '誤', '锁': '鎖', '旧': '舊', '绍': '紹', '联': '聯', '系': '繫',
  '统': '統', '账': '賬', '闭': '閉', '解': '解', '签': '簽', '退': '退',
  '款': '款', '复': '復', '恢': '恢', '访': '訪', '够': '夠', '绑': '綁',
  '断': '斷', '载': '載', '术': '術', '线': '線', '临': '臨', '览': '覽',
  '损': '損', '坏': '壞', '归': '歸', '缴': '繳', '纳': '納', '结': '結',
  '拒': '拒', '扣': '扣', '终': '終', '额': '額', '约': '約', '计': '計',
  '协': '協', '强': '強', '总': '總', '聪': '聰', '赛': '賽', '赠': '贈',
  '礼': '禮', '环': '環', '挥': '揮', '卖': '賣', '补': '補', '给': '給',
  '离': '離', '尘': '塵', '评': '評', '估': '估', '决': '決', '警': '警',
  '累': '累', '倍': '倍', '率': '率', '倒': '倒', '映': '映', '赚': '賺',
  '兑': '兌', '排': '排', '适': '適', '双': '雙', '推': '推', '荐': '薦',
  '醒': '醒', '蓝': '藍', '清': '清', '隔': '隔', '个': '個', '厢': '廂',
  '灯': '燈', '支': '支', '级': '級', '驻': '駐', '职': '職', '暴': '暴',
  '阁': '閣', '储': '儲', '让': '讓', '流': '流', '畅': '暢', '运': '運',
  '迎': '迎', '帐': '帳',

  // Previously covered in original script
  '页': '頁', '预': '預', '场': '場', '关': '關', '会': '會', '属': '屬',
  '于': '於', '无': '無', '烟': '煙', '扰': '擾', '网': '網', '为': '為',
  '说': '說', '这': '這', '从': '從', '来': '來', '没': '沒', '价': '價',
  '余': '餘', '号': '號', '码': '碼', '数': '數', '过': '過', '尝': '嘗',
  '试': '試', '录': '錄', '时': '時', '间': '間', '发': '發', '传': '傳',
  '验': '驗', '继': '繼', '续': '續', '设': '設', '权': '權', '护': '護',
  '启': '啟', '进': '進', '问': '問', '题': '題', '连': '連', '获': '獲',
  '错': '錯', '链': '鏈', '欢': '歡', '独': '獨', '编': '編', '确': '確',
  '认': '認', '选': '選', '择': '擇', '际': '際', '写': '寫', '读': '讀',
  '许': '許', '类': '類', '历': '歷', '单': '單', '办': '辦', '处': '處',
  '变': '變', '换': '換', '请': '請', '输': '輸', '应': '應', '该': '該',
  '当': '當', '刚': '剛', '经': '經', '状': '狀', '态': '態', '购': '購',
  '买': '買', '订': '訂', '实': '實', '馆': '館', '开': '開', '区': '區',
  '现': '現', '显': '顯', '报': '報', '务': '務', '专': '專', '业': '業',
  '团': '團', '队': '隊', '员': '員', '须': '須', '听': '聽', '节': '節',
  '层': '層', '钟': '鐘', '针': '針', '鉴': '鑑', '议': '議', '审': '審',
  '检': '檢', '导': '導', '师': '師', '课': '課', '费': '費', '币': '幣',
  '图': '圖', '库': '庫', '标': '標', '准': '準', '备': '備', '注': '註',
  '册': '冊', '纪': '紀', '样': '樣', '机': '機', '构': '構', '战': '戰',
  '胜': '勝', '败': '敗', '负': '負', '责': '責', '产': '產', '则': '則',
  '规': '規', '范': '範', '围': '圍', '湾': '灣', '台': '臺'
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

console.log('✅ Complete conversion finished!');
console.log(`\nReplaced ${replacementCount} Simplified characters with Traditional equivalents:\n`);

// Show top 30 most frequent replacements
const sortedReplacements = Object.entries(replacements).sort((a, b) => b[1] - a[1]);
sortedReplacements.slice(0, 30).forEach(([simplified, count]) => {
  const traditional = SIMPLIFIED_TO_TRADITIONAL[simplified];
  console.log(`  ${simplified} → ${traditional} (${count}×)`);
});

if (sortedReplacements.length > 30) {
  console.log(`\n... and ${sortedReplacements.length - 30} more character types`);
}
console.log(`\nTotal: ${replacementCount} replacements across ${sortedReplacements.length} character types`);
console.log(`\nFile updated: ${zhHKPath}`);
