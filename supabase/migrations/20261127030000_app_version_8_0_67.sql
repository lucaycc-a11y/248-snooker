INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.67', now(),
  ARRAY['博客後台：預覽直接載入前台真實文章頁（桌面／平板／手機，儲存並更新、新分頁開啟），草稿、排程文章都可預覽，只有管理員看得到','博客後台：頂部固定操作列（狀態、預覽、儲存、發佈）'],
  ARRAY['博客文字排版全面優化：中英文字體搭配、行距與字距、標題換行平衡、引言／表格／FAQ／圖說樣式'],
  ARRAY['後台編輯器內舊的簡化預覽區塊']
) ON CONFLICT (version) DO NOTHING;
