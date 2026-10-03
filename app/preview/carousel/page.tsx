import { AppleCardsCarousel } from "@/components/ui/apple-cards-carousel";

const darkItems = [
  {
    id: "1",
    image: "/images/pool-table-closeup-中八桌球-香港新蒲崗.webp",
    alt: "Professional pool table",
    category: "設備",
    title: "專業中八桌球檯",
    caption: (
      <>
        <strong>頂級星牌球檯</strong>，配合國際認證Aramith球組
      </>
    ),
    detail: (
      <>
        <p>採用星牌專業級桌球檯，符合國際賽事標準，為球手提供最佳擊球體驗。</p>
        <p>配備Aramith比利時進口球組，確保每一擊都精準穩定。</p>
      </>
    ),
  },
  {
    id: "2",
    image: "/images/aramith-balls-box-中八桌球-香港新蒲崗.webp",
    alt: "Aramith balls",
    category: "器材",
    title: "Aramith 比利時球組",
    caption: (
      <>
        國際認證<strong>專業球組</strong>
      </>
    ),
    detail: (
      <p>
        使用比利時Aramith球組，全球唯一獲得WPA世界撞球協會認證的頂級球組。
        耐用度是普通球組的5倍以上。
      </p>
    ),
  },
  {
    id: "3",
    image: "/images/qrcode-checkin-中八桌球-香港新蒲崗.webp",
    alt: "QR code check-in",
    category: "智能系統",
    title: "QR Code 自助入場",
    caption: (
      <>
        <strong>全自動化</strong>無接觸入場系統
      </>
    ),
    detail: (
      <p>
        預訂成功後，系統自動發送QR Code到您的電郵。
        到場時掃描即可開門，全程無需人手操作。
      </p>
    ),
  },
  {
    id: "4",
    image: "/images/chalk-trademark-registered-king-中八桌球-香港新蒲崗.webp",
    alt: "Premium chalk",
    category: "配件",
    title: "頂級巧粉及配件",
    caption: (
      <>
        <strong>King牌巧粉</strong>及專業配件
      </>
    ),
  },
];

const lightItems = [
  {
    id: "light-1",
    image: "/images/pool-table-closeup-2-中八桌球-香港新蒲崗.webp",
    alt: "Pool table detail",
    category: "Equipment",
    title: "Professional Tables",
    caption: (
      <>
        <strong>Tournament-grade</strong> Xingpai tables
      </>
    ),
    detail: (
      <p>
        Our tables meet international tournament standards,
        providing the perfect playing surface for serious players.
      </p>
    ),
  },
  {
    id: "light-2",
    image: "/images/cue-stand-中八桌球-香港新蒲崗.webp",
    alt: "Cue stand",
    category: "Facilities",
    title: "Premium Cue Stands",
    caption: (
      <>
        Organized <strong>storage solutions</strong>
      </>
    ),
  },
  {
    id: "light-3",
    image: "/images/aramith-balls-box-2-中八桌球-香港新蒲崗.webp",
    alt: "Ball set",
    category: "Equipment",
    title: "Premium Ball Sets",
    caption: (
      <>
        <strong>Aramith</strong> professional quality
      </>
    ),
    detail: (
      <p>
        Belgian-made Aramith balls, the only balls certified by
        the World Pool-Billiard Association. Five times more durable
        than standard balls.
      </p>
    ),
  },
];

export default function CarouselPreview() {
  return (
    <main style={{ background: "#000" }}>
      {/* Dark theme section */}
      <section style={{ padding: "80px 0", background: "#000" }}>
        <AppleCardsCarousel
          heading="場地設施"
          items={darkItems}
          theme="dark"
        />
      </section>

      {/* Light theme section */}
      <section style={{ padding: "80px 0", background: "#fff" }}>
        <AppleCardsCarousel
          heading="Our Facilities"
          items={lightItems}
          theme="light"
        />
      </section>

      {/* Narrow viewport test */}
      <section style={{ padding: "80px 0", background: "#0a0d12" }}>
        <div style={{ maxWidth: "390px", margin: "0 auto" }}>
          <AppleCardsCarousel
            heading="Mobile View"
            items={darkItems.slice(0, 3)}
            theme="dark"
          />
        </div>
      </section>
    </main>
  );
}
