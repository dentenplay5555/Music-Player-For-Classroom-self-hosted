# 🎵 QR Music — Multi-Room Cloudflare Music Queue & Classroom Player

> ระบบเว็บขอเพลงผ่าน QR Code สำหรับกิจกรรมที่มีหลายห้อง แต่ละห้องมีคิวเพลงแยกกัน ผู้เข้าร่วมสแกน QR แล้วส่ง YouTube URL ได้ทันทีโดยไม่ต้องสมัครสมาชิก เพลงจะเข้าคิวอัตโนมัติ และหน้าจอหลักของห้องจะอัปเดตสถานะแบบเรียลไทม์ผ่าน WebSocket

สถาปัตยกรรมตรงตามเอกสารสเปค `scope.md` v1.0 ทุกประการ:
- **Cloudflare Worker + Hono**: จัดการ REST API, URL Validation, Rate limits
- **Cloudflare D1 (SQLite)**: จัดการข้อมูลห้อง คิวเพลง ประวัติเหตุการณ์แบบถาวร
- **Cloudflare Durable Objects (`RoomCoordinator`)**: ตัวประสานงานห้อง จัดการ WebSocket แบบ Hibernation และกระจายคิวแบบ Realtime
- **YouTube IFrame Player API**: จอฉาย 16:9 สำหรับห้องเรียน/เวที รองรับ Fullscreen และระบบเล่นเพลงต่อเนื่อง
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS (Dark Jukebox Theme)

---

## 🌟 ฟีเจอร์หลัก (Key Features)

1. 📱 **Anonymous & No App Needed (ขอเพลงทันทีไม่ต้องโหลดแอป)**:
   - ผู้ร่วมงานใช้กล้องมือถือสแกน QR Code แล้ววางลิงก์ YouTube (คลิปปกติ, Shorts หรือ MV)
   - มีปุ่มวางลิงก์จากคลิปบอร์ดสะดวกรวดเร็ว
   - มีข้อความยืนยันสถานะและลำดับในคิว (Queue Position Indicator)
2. 📺 **Stage / Classroom Display (จอ Player สำหรับฉายขึ้นโปรเจกเตอร์/ทีวี)**:
   - ฝัง YouTube Embedded Player แบบ 16:9 รองรับโหมดเต็มจอ (**Fullscreen**)
   - แสดง QR Code ขนาดใหญ่ (**SCAN TO REQUEST**) พร้อม URL ของห้อง
   - รองรับการปรับแต่ง URL ใน QR Code ให้เป็น IP เครื่อง หรือ Domain จริงผ่านตัวแปร `PUBLIC_URL`
   - จัดการข้อจำกัด **Browser Autoplay Policy**: แสดงปุ่ม *Start Jukebox* เพื่อเปิดเสียงครั้งแรกอย่างถูกต้อง
   - ตรวจจับวิดีโอที่ติดลิขสิทธิ์หรือฝังเล่นไม่ได้ (Error 100, 101, 150) และข้ามไปยังเพลงถัดไปให้อัตโนมัติ ป้องกันคิวค้าง
3. ⚡ **Realtime Synchronization (WebSocket via Durable Objects)**:
   - อัปเดตสถานะเพลงที่กำลังเล่นและลำดับคิวเพลงทันทีทุกหน้าจอ
   - ระบบ Reconnect อัตโนมัติพร้อม Exponential Backoff
4. 🛡️ **Admin Dashboard (แผงควบคุมผู้ดูแล)**:
   - สร้างห้องได้ไม่จำกัด แต่ละห้องแยกคิวเพลงอิสระ
   - เปิด/ปิดรับคำขอเพลง (`open` / `closed`) ชั่วคราวได้ตลอดเวลา
   - สุ่มรหัสห้องใหม่ (**Rotate Code**) ป้องกันคนนอกส่งเพลงก่อกวน
   - ข้ามเพลง, ลบเพลง, สั่งเล่นเพลงถัดไป และล้างคิวทั้งหมดพร้อมหน้าต่างยืนยันความปลอดภัย
5. 🔒 **Security & Abuse Prevention**:
   - Rate limiting: จำกัดการส่งคำขอไม่เกิน 5 ครั้ง/นาทีต่อ IP และมี Cooldown ขั้นต่ำ 5 วินาที
   - จำกัดความยาวคิวเพลงสูงสุด 100 เพลงต่อห้อง
   - ป้องกันการส่งเพลงซ้ำในคิวเดียวกัน

---

## 📁 โครงสร้างโปรเจกต์ (Repository Structure)

```
qr-music/
├── apps/
│   └── web/                   # Frontend React 19 + Vite + Tailwind CSS
│       ├── src/
│       │   ├── api/client.ts   # API Client & WebSocket Helper
│       │   ├── components/     # QRCodeDisplay, YouTubePlayer, Navbar
│       │   └── pages/          # RequestPage, PlayerPage, AdminPage, HomePage
├── workers/
│   └── api/                   # Cloudflare Workers + Hono API
│       ├── src/
│       │   ├── durable-objects/RoomCoordinator.ts  # Durable Object WebSocket Room
│       │   ├── middleware/     # RateLimit, Auth
│       │   ├── routes/         # Public & Admin API
│       │   └── services/       # Queue Engine & YouTube oEmbed
│       └── wrangler.toml      # D1 & Durable Objects bindings
├── packages/
│   └── shared/                # TypeScript shared types, events & constants
├── migrations/
│   └── 0001_initial.sql       # D1 SQLite Database Schema
├── scope.md                   # Technical Specification v1.0
└── package.json               # Monorepo configuration
```

---

## 🚀 วิธีติดตั้งและเริ่มต้นใช้งาน (Getting Started)

### 1. ข้อกำหนดเบื้องต้น
- [Node.js](https://nodejs.org/) v20 หรือ v22 ขึ้นไป
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (ติดตั้งมาพร้อมใน devDependencies)

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. รัน Database Migration (Local D1)
```bash
npm run d1:migrate:local
```

### 4. เริ่มต้นระบบ (Development Mode)
คำสั่งเดียวเปิดทั้ง Cloudflare Worker API และ Frontend Vite พร้อมกัน:
```bash
npm run dev
```

- **Frontend Web UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API & WebSocket**: [http://localhost:3001](http://localhost:3001)
- **Admin Password**: `TM-OPERA_O` (สามารถปรับเปลี่ยนได้ใน `workers/api/wrangler.toml` หรือ `.env`)

---

## 📱 เส้นทางหน้าจอ (Routing)

| เส้นทาง | คำอธิบาย |
|---|---|
| `/` | หน้าแรก: ป้อนรหัสห้อง หรือไปหน้า Admin |
| `/r/:roomCode` | หน้าขอเพลงสำหรับผู้เข้าร่วม (Mobile-friendly) |
| `/p/:roomCode` | หน้าจอ Player สำหรับโปรเจกเตอร์/ทีวี พร้อม QR Code ขนาดใหญ่ |
| `/admin` | แผงควบคุม Admin Dashboard สำหรับจัดการห้องและคิว |

---

## 🌐 การตั้งค่า QR Code สำหรับวง Wi-Fi / LAN จริง
เพื่อให้มือถือของผู้ร่วมงานสแกน QR Code แล้วเข้าใช้งานได้:
1. ดูหมายเลข IP ของคอมพิวเตอร์ในวง Wi-Fi (เช่น `192.168.1.143`)
2. ใส่ค่าในไฟล์ `workers/api/wrangler.toml` (หรือ `.env`):
   ```toml
   [vars]
   PUBLIC_URL = "http://192.168.1.143:5173"
   ```
3. QR Code บนหน้าจอ Player จะเปลี่ยนไปชี้ยัง IP นั้นทันที ทำให้มือถือทุกเครื่องที่อยู่ในวง Wi-Fi เดียวกันสแกนแล้วขอเพลงได้ทันที
