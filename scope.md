# QR Music — Technical Specification v1.0

เอกสารออกแบบระบบ · 22 ตุลาคม 2026 · Multi-room · Anonymous · Auto Queue · WebSocket · Dark Jukebox

ระบบเว็บขอเพลงผ่าน QR Code สำหรับกิจกรรมที่มีหลายห้อง แต่ละห้องมีคิวเพลงแยกกัน ผู้เข้าร่วมสแกน QR แล้วส่ง YouTube URL ได้ทันทีโดยไม่ต้องสมัครสมาชิก เพลงจะเข้าคิวอัตโนมัติ และหน้าจอหลักของห้องจะอัปเดตสถานะผ่าน WebSocket

## Multi-room

หนึ่งห้องต่อหนึ่งคิว

## Auto Queue

ส่งแล้วเข้าคิวทันที

## Realtime

ซิงก์ข้อมูลด้วย WebSocket

## Anonymous

ไม่ต้องมีบัญชีผู้ใช้

## 1. เป้าหมายและขอบเขตระบบ

### 1.1 เป้าหมาย

- ให้ผู้ร่วมงานส่งเพลงจากโทรศัพท์ได้โดยไม่ต้องติดตั้งแอป
- ให้แต่ละห้องมี QR Code, URL, คิว และ Player ของตัวเอง
- แสดงเพลงที่กำลังเล่นและเพลงลำดับถัดไปบนจอขนาดใหญ่
- กระจายการเปลี่ยนแปลงคิวให้ผู้ใช้งานทุกคนในห้องเห็นผ่าน WebSocket
- ให้ระบบทำงานได้โดยไม่ต้องมี Admin คอยอนุมัติทุกเพลง แต่มีมาตรการควบคุมและหยุดระบบได้

### 1.2 สิ่งที่รวมใน MVP

| ความสามารถ | ขอบเขต                                            |
| ---------- | ------------------------------------------------- |
| สร้างห้อง  | ผู้ดูแลสร้างและจัดการห้อง                         |
| QR Code    | ลิงก์ตรงไปยังหน้าขอเพลงของห้อง                    |
| ขอเพลง     | ส่ง YouTube URL โดยไม่ล็อกอิน                     |
| Queue      | FIFO และมีสถานะของเพลง                            |
| Player     | YouTube IFrame Player API                         |
| Realtime   | WebSocket พร้อมกลไก reconnect                     |
| Moderation | ลบเพลง ปิดรับเพลง และข้ามเพลง                     |
| Security   | Rate limit, URL validation, Admin authentication  |
| Deployment | Cloudflare Pages, Workers, D1 และ Durable Objects |

### 1.3 สิ่งที่ยังไม่รวม

- ดาวน์โหลดเพลงหรือแยกเสียงออกจาก YouTube
- ระบบโหวตเพลง
- การสมัครสมาชิกของผู้ขอเพลง
- การค้นหาเพลงจาก YouTube ภายในเว็บ
- ระบบชำระเงินหรือระบบสมาชิกแบบพรีเมียม
- การรับประกันว่าวิดีโอทุก URL จะเล่นได้หรือไม่มีโฆษณา

## 2. สถาปัตยกรรมระบบ

Request Web — มือถือผู้ร่วมงาน

React · Vite · TypeScript · Tailwind

HTTPS / WebSocket

Cloudflare Worker + Hono

REST API · Auth · Validation · Rate limits · Routing

Durable Object

Room Coordinator

หนึ่ง instance ต่อห้อง · WebSocket · ควบคุมลำดับเหตุการณ์

SQL

Cloudflare D1

ห้อง · คิวเพลง · ประวัติ · ผู้ดูแล

WebSocket events

Player Web — จอหลักประจำห้อง

YouTube IFrame Player API · Queue UI · Fullscreen

### 2.1 ทำไมเลือก Durable Objects เพิ่มจาก Stack เริ่มต้น?

Workers + D1 เหมาะสำหรับ API และการจัดเก็บข้อมูล แต่เมื่อมีหลายห้องและต้องส่ง WebSocket แบบแยกห้อง ควรมี Durable Object ต่อห้อง เพื่อทำหน้าที่เป็นตัวประสานงาน (Room Coordinator)

หน้าที่หลัก:

- จัดการ WebSocket connections ของห้องนั้น
- กระจายเหตุการณ์ไปยังทุก client ที่เชื่อมต่อกับห้อง
- กำหนดลำดับเหตุการณ์สำหรับการเพิ่มเพลงและเปลี่ยนคิว
- ลดปัญหาการประมวลผลคำขอพร้อมกัน
- แจ้งให้ client ขอ snapshot ใหม่เมื่อ reconnect

อย่างไรก็ตาม Durable Object ไม่ได้ทำให้ข้อมูล D1 กับ state ในหน่วยความจำเป็นธุรกรรมเดียวกันโดยอัตโนมัติ การบันทึกคิวลง D1 ต้องออกแบบให้สำเร็จก่อนประกาศว่าเพลงเข้าคิวแล้ว และต้องมีวิธีกู้คืนสถานะเมื่อ instance เริ่มทำงานใหม่

## 3. User Flow

### 3.1 ผู้ร่วมงานส่งเพลง

\#chatgpt-mermaid-\_r_1pn\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_1pn\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1pn\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1pn\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1pn\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_1pn\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_1pn\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_1pn\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_1pn\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_1pn\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1pn\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1pn\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_1pn\_ p{margin:0;}#chatgpt-mermaid-\_r_1pn\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_1pn\_ .label text,#chatgpt-mermaid-\_r_1pn\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ .node rect,#chatgpt-mermaid-\_r_1pn\_ .node circle,#chatgpt-mermaid-\_r_1pn\_ .node ellipse,#chatgpt-mermaid-\_r_1pn\_ .node polygon,#chatgpt-mermaid-\_r_1pn\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ .rough-node .label text,#chatgpt-mermaid-\_r_1pn\_ .node .label text,#chatgpt-mermaid-\_r_1pn\_ .image-shape .label,#chatgpt-mermaid-\_r_1pn\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_1pn\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ .rough-node .label,#chatgpt-mermaid-\_r_1pn\_ .node .label,#chatgpt-mermaid-\_r_1pn\_ .image-shape .label,#chatgpt-mermaid-\_r_1pn\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_1pn\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_1pn\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1pn\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1pn\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_1pn\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_1pn\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1pn\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1pn\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_1pn\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_1pn\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1pn\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_1pn\_ .icon-shape,#chatgpt-mermaid-\_r_1pn\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_1pn\_ .icon-shape p,#chatgpt-mermaid-\_r_1pn\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_1pn\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_1pn\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1pn\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_1pn\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_1pn\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_1pn\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_1pn\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_1pn\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_1pn\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1pn\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_1pn\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1pn\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_1pn\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_1pn\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_1pn\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_1pn\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ .node rect,#chatgpt-mermaid-\_r_1pn\_ .node circle,#chatgpt-mermaid-\_r_1pn\_ .node ellipse,#chatgpt-mermaid-\_r_1pn\_ .node polygon,#chatgpt-mermaid-\_r_1pn\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1pn\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_1pn\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_1pn\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_1pn\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1pn\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}สแกน QR ของห้องเปิดหน้า Requestวาง YouTube URLURL ถูกต้อง?แสดงข้อผิดพลาดส่งคำขอไปยัง APIห้องเปิดรับเพลง?แจ้งว่าปิดรับคำขอผ่าน Rate Limit?แจ้งให้รอก่อนส่งใหม่เพลงซ้ำหรือไม่?แจ้งว่ามีเพลงนี้ในคิวแล้วบันทึกเพลงใน D1ส่ง queue.updated ผ่านWebSocketแสดงตำแหน่งในคิวไม่ถูกต้องถูกต้องไม่ใช่ไม่ใช่ซ้ำไม่ซ้ำ

### 3.2 Player เปลี่ยนเพลง

\#chatgpt-mermaid-\_r_1q0\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_1q0\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1q0\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1q0\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1q0\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_1q0\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_1q0\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_1q0\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_1q0\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_1q0\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1q0\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1q0\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_1q0\_ p{margin:0;}#chatgpt-mermaid-\_r_1q0\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_1q0\_ .label text,#chatgpt-mermaid-\_r_1q0\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ .node rect,#chatgpt-mermaid-\_r_1q0\_ .node circle,#chatgpt-mermaid-\_r_1q0\_ .node ellipse,#chatgpt-mermaid-\_r_1q0\_ .node polygon,#chatgpt-mermaid-\_r_1q0\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ .rough-node .label text,#chatgpt-mermaid-\_r_1q0\_ .node .label text,#chatgpt-mermaid-\_r_1q0\_ .image-shape .label,#chatgpt-mermaid-\_r_1q0\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_1q0\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ .rough-node .label,#chatgpt-mermaid-\_r_1q0\_ .node .label,#chatgpt-mermaid-\_r_1q0\_ .image-shape .label,#chatgpt-mermaid-\_r_1q0\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_1q0\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_1q0\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1q0\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1q0\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_1q0\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_1q0\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1q0\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1q0\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_1q0\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_1q0\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1q0\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_1q0\_ .icon-shape,#chatgpt-mermaid-\_r_1q0\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_1q0\_ .icon-shape p,#chatgpt-mermaid-\_r_1q0\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_1q0\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_1q0\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1q0\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_1q0\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_1q0\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_1q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_1q0\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_1q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_1q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1q0\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_1q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1q0\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_1q0\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_1q0\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_1q0\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_1q0\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ .node rect,#chatgpt-mermaid-\_r_1q0\_ .node circle,#chatgpt-mermaid-\_r_1q0\_ .node ellipse,#chatgpt-mermaid-\_r_1q0\_ .node polygon,#chatgpt-mermaid-\_r_1q0\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1q0\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_1q0\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_1q0\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_1q0\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1q0\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Player เชื่อมต่อรับ Queue Snapshotมีเพลงกำลังเล่น?มีเพลงในคิว?แสดง Waiting Screenโหลดเพลงถัดไปเล่นเพลงปัจจุบันต่อYouTube Player พร้อม?แสดงปุ่ม Start Playbackลองเริ่มเล่นเล่นสำเร็จ?แสดงสถานะเล่นไม่ได้Admin ข้าม หรือใช้กฎ Skipแสดง Playingเพลงจบ?บันทึก Playedและเลือกเพลงถัดไปไม่มีไม่มีมีมีไม่ใช่ไม่ใช่ไม่ใช่

กฎสำคัญ: การที่เพลงถูกส่งเข้าคิวสำเร็จ ไม่ได้หมายความว่าเพลงนั้นเริ่มเล่นแล้ว ต้องแยกสถานะ `queued`, `playing` และ `played` ออกจากกัน

### 3.3 กรณีมีคนส่งเพลงพร้อมกัน

Room Coordinator ต้องเป็นจุดประสานงานของการเพิ่มเพลงและเปลี่ยนคิว เพื่อให้ทุกคำขอได้รับลำดับที่ชัดเจน

ตัวอย่าง: A และ B ส่งเพลงในเวลาใกล้กัน ระบบต้องกำหนดให้เพลงหนึ่งอยู่ลำดับก่อนอีกเพลงอย่างแน่นอน ไม่ใช่ให้ Client แต่ละเครื่องตัดสินลำดับเอง

แนวทาง:

1. รับคำขอผ่าน API
2. ตรวจสอบห้องและเงื่อนไข
3. บันทึกข้อมูลโดยใช้ transaction ที่เหมาะสม
4. สร้าง event พร้อม `room_version` ใหม่
5. Broadcast event หลังการบันทึกสำเร็จ
6. หาก client ขาดการเชื่อมต่อ ให้ดึง snapshot ล่าสุดจาก API

สำหรับการเริ่มเล่นเพลงถัดไป ต้องใช้กลไกเดียวกันในการเปลี่ยนสถานะคิว เพื่อป้องกัน Player หลายเครื่องหรือ event ซ้ำทำให้คิวเลื่อนไปหลายครั้ง

## 4. UI Specification — Dark Jukebox

กำหนดแนวทางภาพรวมเป็นพื้นหลังสีดำอมกรมท่า มีพื้นผิวแบบ glass เล็กน้อย ตัวอักษรอ่านง่าย และเน้นสีม่วง/ฟ้าเฉพาะสถานะสำคัญ

## QR MUSIC

ROOM A · LIVE SESSION

LIVE

YouTube Player

16:9 · Embedded playback

### Now Playing

ชื่อวิดีโอจาก YouTube

Requested anonymously

\#01

### Up Next

3 songs

01

เพลงลำดับถัดไป

Queued

02

เพลงในคิว

Queued

03

เพลงในคิว

Queued

SCAN ME

Request a song

Scan the QR code to join the queue

ตัวอย่าง Wireframe เชิงแนวคิด ไม่ใช่ข้อมูลจากระบบจริง

### 4.1 หน้า Request — `/r/:roomCode`

องค์ประกอบจากบนลงล่าง:

1. ชื่อห้องและสถานะเปิดรับเพลง
2. Input สำหรับวาง YouTube URL
3. ปุ่ม `Add to Queue`
4. ผลลัพธ์เมื่อส่งสำเร็จ พร้อมตำแหน่งในคิว
5. รายการเพลงปัจจุบันและเพลงถัดไป
6. จำนวนเพลงในคิวและสถานะเชื่อมต่อ
7. ข้อความแจ้งข้อจำกัดหรือการเล่นไม่ได้

UX requirements:

- รองรับจอมือถือความกว้าง 320px ขึ้นไป
- ปุ่มหลักต้องกดง่ายและมีสถานะ loading
- ป้องกันการกดส่งซ้ำขณะ request กำลังทำงาน
- แสดงข้อผิดพลาดเป็นข้อความที่เข้าใจง่าย
- ไม่จำเป็นต้องให้ผู้ใช้เปิด WebSocket ก่อนส่งเพลง แต่สามารถใช้ WebSocket เพื่ออัปเดตคิวหลังส่งได้

### 4.2 หน้า Player — `/p/:roomCode`

- Player ขนาด 16:9 เป็นพื้นที่หลัก
- แสดงชื่อเพลงที่กำลังเล่น
- แสดงเพลงถัดไป 3–5 เพลง
- แสดง QR Code และ URL ของห้อง
- แสดงสถานะ `Connecting`, `Ready`, `Playing`, `Paused`, `Playback blocked`, `Error`
- รองรับ Fullscreen API และการกลับเข้าโหมดปกติ
- ซ่อนปุ่มควบคุมที่ผู้ชมไม่ควรใช้

ข้อควรระวัง: การซ่อน UI ของแอปไม่สามารถซ่อนหรือดัดแปลงองค์ประกอบภายใน YouTube Player ได้ตามใจ ต้องรักษาข้อกำหนดของ YouTube Embedded Player

### 4.3 หน้า Admin — `/admin`

- Dashboard รายชื่อห้อง
- จำนวนเพลงในคิวและสถานะ Player
- เปิด/ปิดรับคำขอ
- ลบเพลงและข้ามเพลง
- ล้างคิว โดยมีหน้าต่างยืนยัน
- ดูประวัติเหตุการณ์
- เปลี่ยนการตั้งค่าห้องและ QR Code

การข้ามเพลงต้องตรวจสิทธิ์ที่ API และสร้าง event ที่ตรวจสอบย้อนหลังได้

## 5. Database Schema

ใช้ Cloudflare D1 (SQLite) เป็นแหล่งข้อมูลถาวรหลัก โดยให้ Durable Object ประสานงาน WebSocket และลำดับเหตุการณ์ ไม่ให้ client เขียนฐานข้อมูลโดยตรง

### 5.1 Entity Relationship

\#chatgpt-mermaid-\_r_1qt\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_1qt\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1qt\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1qt\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1qt\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1qt\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_1qt\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_1qt\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_1qt\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_1qt\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_1qt\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_1qt\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1qt\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1qt\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_1qt\_ p{margin:0;}#chatgpt-mermaid-\_r_1qt\_ .entityBox{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_1qt\_ .relationshipLabelBox{fill:rgb(48, 48, 48);opacity:0.7;background-color:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1qt\_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-\_r_1qt\_ .labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_1qt\_ .edgeLabel{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1qt\_ .edgeLabel .label rect{fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1qt\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1qt\_ .edgeLabel .label{fill:rgb(31, 78, 148);font-size:14px;}#chatgpt-mermaid-\_r_1qt\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1qt\_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-\_r_1qt\_ .node rect,#chatgpt-mermaid-\_r_1qt\_ .node circle,#chatgpt-mermaid-\_r_1qt\_ .node ellipse,#chatgpt-mermaid-\_r_1qt\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_1qt\_ .relationshipLine{stroke:rgb(175, 175, 175);stroke-width:1px;fill:none;}#chatgpt-mermaid-\_r_1qt\_ .marker{fill:none!important;stroke:rgb(175, 175, 175)!important;stroke-width:1;}#chatgpt-mermaid-\_r_1qt\_ [data-look=neo].labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_1qt\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_1qt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_1qt\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_1qt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_1qt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1qt\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_1qt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1qt\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}ROOMStextidPKtextcodeUKtextnametextstatusintegerqueue_versiontextcreated_atSONGStextidPKtextroom_idFKtextvideo_idtextstatusintegerpositiontextcreated_atADMINStextidPKtextroom_idFKtextauth_subjecttextroleROOM_EVENTSintegeridPKtextroom_idFKintegerversiontextevent_typetextpayloadPLAYER_SESSIONStextidPKtextroom_idFKtextstatustextlast_seen_atcontainsauthorizesrecordshas

### 5.2 ตาราง `rooms`

| Column          | Type    | Constraint / Purpose                              |
| --------------- | ------- | ------------------------------------------------- |
| `id`            | TEXT    | Primary key แบบ UUID                              |
| `code`          | TEXT    | Unique, ใช้ใน URL และ QR                          |
| `name`          | TEXT    | ชื่อห้อง                                          |
| `status`        | TEXT    | `open`, `closed`, `archived`                      |
| `queue_version` | INTEGER | เลขเวอร์ชันคิว เพิ่มทุกครั้งที่เกิดการเปลี่ยนแปลง |
| `settings_json` | TEXT    | การตั้งค่าที่ผ่าน validation                      |
| `created_at`    | TEXT    | เวลา UTC แบบ ISO 8601                             |
| `updated_at`    | TEXT    | เวลาแก้ไขล่าสุด                                   |

`code` ควรสุ่มให้เดายาก ไม่ใช้ชื่อห้องหรือลำดับเลขง่าย ๆ เป็น security credential แต่ถึงเดา code ได้ก็ต้องไม่ทำให้ผู้เข้าชมมีสิทธิ์ Admin

### 5.3 ตาราง `songs`

| Column               | Type    | Constraint / Purpose                       |
| -------------------- | ------- | ------------------------------------------ |
| `id`                 | TEXT    | Primary key                                |
| `room_id`            | TEXT    | Foreign key ไป `rooms`                     |
| `video_id`           | TEXT    | YouTube video ID                           |
| `title`              | TEXT    | ชื่อวิดีโอ ถ้ามีข้อมูลที่เชื่อถือได้       |
| `status`             | TEXT    | สถานะเพลง                                  |
| `position`           | INTEGER | ลำดับเพลงในคิว                             |
| `request_token_hash` | TEXT    | Token สำหรับจัดการคำขอโดยไม่เก็บ token ดิบ |
| `created_at`         | TEXT    | เวลาที่รับคำขอ                             |
| `started_at`         | TEXT    | เวลาเริ่มเล่น                              |
| `finished_at`        | TEXT    | เวลาจบหรือถูกนำออกจากการเล่น               |

แนะนำสถานะดังนี้:

- `queued` — อยู่ในคิว
- `playing` — กำลังเล่นตามสถานะของระบบ
- `played` — เล่นจบ
- `skipped` — ถูกข้าม
- `rejected` — ถูกปฏิเสธหรือเล่นไม่ได้และถูกนำออกจากคิว
- `removed` — ถูกลบโดย Admin

ควรใช้ transaction เพื่อให้มีเพลงสถานะ `playing` ได้ไม่เกินหนึ่งเพลงต่อห้อง และกำหนดนโยบายชัดเจนว่าจะยอมให้เพลงเดียวกันซ้ำได้หรือไม่

### 5.4 ตาราง `admins`

| Column         | Type | Purpose                    |
| -------------- | ---- | -------------------------- |
| `id`           | TEXT | Primary key                |
| `room_id`      | TEXT | ห้องที่ได้รับสิทธิ์        |
| `auth_subject` | TEXT | ตัวระบุผู้ใช้จากระบบ Login |
| `role`         | TEXT | `owner`, `admin`           |
| `created_at`   | TEXT | เวลาที่เพิ่มสิทธิ์         |

ใช้ unique constraint ที่ `(room_id, auth_subject)` เพื่อไม่ให้เพิ่มสิทธิ์เดิมซ้ำ

### 5.5 ตาราง `room_events`

| Column         | Type    | Purpose                |
| -------------- | ------- | ---------------------- |
| `id`           | INTEGER | Primary key            |
| `room_id`      | TEXT    | ห้องที่เกิดเหตุการณ์   |
| `version`      | INTEGER | เลขเวอร์ชันของห้อง     |
| `event_type`   | TEXT    | ประเภท event           |
| `payload_json` | TEXT    | ข้อมูล event ที่จำเป็น |
| `created_at`   | TEXT    | เวลา UTC               |

ควรกำหนด `UNIQUE(room_id, version)` เพื่อใช้ตรวจสอบลำดับเหตุการณ์และป้องกัน event version ซ้ำ

ตัวอย่าง event ได้แก่ `song.added`, `song.started`, `song.skipped`, `room.closed`

ไม่ควรเก็บ IP address หรือข้อมูลระบุตัวตนละเอียดใน event log หากไม่จำเป็นต่อการป้องกันการโจมตี

### 5.6 ตาราง `player_sessions`

ใช้ตรวจสอบว่ามี Player ออนไลน์อยู่หรือไม่ โดยไม่ถือว่าการเชื่อมต่อ WebSocket เพียงอย่างเดียวเป็นหลักฐานว่า Player กำลังเล่นเพลงจริง

ข้อมูลประกอบด้วย `id`, `room_id`, `status`, `last_seen_at` และข้อมูลรุ่นของ client ตามความจำเป็น

ควรกำหนดอายุ session และล้างข้อมูลเก่าตามนโยบาย retention

### 5.7 ตัวอย่าง Migration

```

PRAGMA foreign_keys = ON;

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'archived')),
  queue_version INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  video_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'playing', 'played',
      'skipped', 'rejected', 'removed'
    )),
  position INTEGER NOT NULL,
  request_token_hash TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX idx_songs_queue
  ON songs(room_id, status, position);

CREATE UNIQUE INDEX idx_one_playing_song_per_room
  ON songs(room_id)
  WHERE status = 'playing';

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  auth_subject TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin')),
  created_at TEXT NOT NULL,
  UNIQUE(room_id, auth_subject)
);

CREATE TABLE room_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, version)
);

CREATE TABLE player_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  status TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

```

ข้อกำหนดเพิ่มเติม: การเลื่อนตำแหน่งเพลงและการเปลี่ยนสถานะต้องทำใน transaction เดียวกับการเพิ่ม `queue_version` และสร้าง `room_events` เพื่อไม่ให้ฐานข้อมูลกับ WebSocket แสดงข้อมูลคนละเวอร์ชัน

## 6. API Contract

กำหนด Base URL เป็น `/api/v1` และให้ response มีรูปแบบเดียวกันทุก endpoint

### 6.1 รูปแบบ Response

สำเร็จ:

```

{
  "ok": true,
  "data": {},
  "requestId": "req_example"
}

```

ผิดพลาด:

```

{
  "ok": false,
  "error": {
    "code": "QUEUE_FULL",
    "message": "ขณะนี้คิวเพลงเต็มแล้ว"
  },
  "requestId": "req_example"
}

```

`requestId` ใช้ติดตาม log ของ request ไม่ใช่ token สำหรับอนุญาตการเข้าถึงข้อมูล

### 6.2 Public Endpoints

| Method | Endpoint              | หน้าที่                       |
| ------ | --------------------- | ----------------------------- |
| `GET`  | `/rooms/:code`        | ดูข้อมูลห้อง                  |
| `GET`  | `/rooms/:code/queue`  | ดึง snapshot ของคิว           |
| `POST` | `/rooms/:code/songs`  | ส่งเพลงเข้าคิว                |
| `GET`  | `/rooms/:code/events` | ดู event ล่าสุดเพื่อ recovery |

ตัวอย่างส่งเพลง:

```

{
  "youtubeUrl": "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  "requestId": "client-generated-uuid"
}

```

`requestId` ในตัวอย่างนี้ใช้เป็น idempotency key เพื่อให้การ retry จากเครือข่ายไม่สร้างเพลงซ้ำ ต้องมีการจัดเก็บ key พร้อมผลลัพธ์ที่เกี่ยวข้องและกำหนดอายุการใช้งานอย่างเหมาะสม

ตัวอย่าง response:

```

{
  "ok": true,
  "data": {
    "song": {
      "id": "song_uuid",
      "videoId": "M7lc1UVf-VE",
      "status": "queued",
      "position": 4
    },
    "queueVersion": 19
  },
  "requestId": "req_example"
}

```

การรับคำขอสำเร็จต้องหมายถึงเพลงถูกบันทึกจริงแล้วเท่านั้น หากการบันทึกล้มเหลว API ต้องตอบข้อผิดพลาด ไม่ใช่ตอบสำเร็จแล้วหวังว่า WebSocket จะซิงก์ให้เอง

### 6.3 Admin Endpoints

| Method   | Endpoint                              | หน้าที่                       |
| -------- | ------------------------------------- | ----------------------------- |
| `POST`   | `/admin/rooms`                        | สร้างห้อง                     |
| `PATCH`  | `/admin/rooms/:id`                    | เปลี่ยนสถานะและการตั้งค่าห้อง |
| `POST`   | `/admin/rooms/:id/rotate-code`        | เปลี่ยน room code หากจำเป็น   |
| `POST`   | `/admin/rooms/:id/songs/:songId/skip` | ข้ามเพลง                      |
| `DELETE` | `/admin/rooms/:id/songs/:songId`      | ลบเพลง                        |
| `POST`   | `/admin/rooms/:id/queue/clear`        | ล้างคิว                       |
| `POST`   | `/admin/rooms/:id/player/next`        | ขอให้ Player เปลี่ยนเพลง      |

ทุก endpoint ที่มีผลกับคิวต้องทำงานแบบ idempotent เมื่อเหมาะสม และต้องตรวจสอบว่าเพลงที่ระบุเป็นของห้องเดียวกับ URL เสมอ

### 6.4 HTTP Status Codes

| Status | ใช้เมื่อ                                        |
| ------ | ----------------------------------------------- |
| `200`  | อ่านข้อมูลหรือดำเนินการสำเร็จ                   |
| `201`  | สร้างคำขอเพลงสำเร็จ                             |
| `400`  | Request body หรือ URL ไม่ถูกต้อง                |
| `401`  | ยังไม่เข้าสู่ระบบ Admin                         |
| `403`  | ไม่มีสิทธิ์ดำเนินการ                            |
| `404`  | ไม่พบห้องหรือเพลง                               |
| `409`  | Conflict เช่น request ซ้ำหรือสถานะเปลี่ยนไปแล้ว |
| `413`  | Request body ใหญ่เกินไป                         |
| `422`  | URL ถูก parse ได้แต่ไม่รองรับ                   |
| `429`  | เกิน Rate Limit                                 |
| `503`  | ระบบที่จำเป็นไม่พร้อมให้บริการชั่วคราว          |

## 7. WebSocket Protocol

ใช้ WebSocket ผ่าน Durable Object ของแต่ละห้อง โดยเชื่อมต่อผ่าน URL เช่น:

`wss://api.example.com/api/v1/rooms/ROOM_CODE/ws`

การเชื่อมต่อ WebSocket ต้องผ่านการตรวจ room code, Origin และข้อจำกัดการเชื่อมต่อก่อนยอมรับ

### 7.1 Server → Client Events

```

{
  "type": "queue.updated",
  "roomCode": "ROOM_CODE",
  "version": 20,
  "payload": {
    "addedSongId": "song_uuid",
    "position": 4
  }
}

```

Event ที่ต้องรองรับ:

| Event             | ความหมาย                       |
| ----------------- | ------------------------------ |
| `room.snapshot`   | สถานะห้องและคิวล่าสุด          |
| `queue.updated`   | มีการเปลี่ยนแปลงคิว            |
| `song.added`      | มีเพลงใหม่                     |
| `song.started`    | ระบบเริ่มสถานะเพลง             |
| `song.finished`   | เพลงจบ                         |
| `song.skipped`    | เพลงถูกข้าม                    |
| `room.updated`    | สถานะหรือการตั้งค่าห้องเปลี่ยน |
| `player.status`   | สถานะรายงานจาก Player          |
| `resync.required` | Client ต้องขอ snapshot ใหม่    |

### 7.2 Client → Server Messages

Client ทั่วไปส่งได้เฉพาะข้อความที่จำเป็น เช่น `client.hello` เพื่อแจ้งเวอร์ชันล่าสุดที่รู้จัก

ไม่อนุญาตให้ Client สั่ง `song.added`, `song.started` หรือแก้ `queueVersion` เอง เหตุการณ์เหล่านี้ต้องเกิดจาก Server เท่านั้น

คำขอเพลงและคำสั่ง Admin ควรใช้ REST API เป็นหลักใน MVP เพื่อลดความซับซ้อนในการตรวจสิทธิ์และการ retry

### 7.3 Reconnect และ Event Ordering

- Client เก็บ `lastSeenVersion`
- เมื่อเชื่อมต่อใหม่ ให้รับ snapshot ล่าสุดหรือขอ event ที่ขาดไป
- หาก version กระโดดจาก 20 เป็น 23 โดยไม่มี 21 และ 22 ให้ resync
- ห้ามนำ event เก่ามาทับ snapshot ใหม่
- ใช้ exponential backoff พร้อม jitter สำหรับ reconnect
- ปิด WebSocket ที่ไม่มีการใช้งานหรือส่งข้อมูลผิดรูปแบบอย่างต่อเนื่อง

Durable Objects รองรับ WebSocket แบบ hibernation ซึ่งเหมาะกับการเชื่อมต่อที่เปิดค้างไว้ และช่วยลดการใช้ทรัพยากรเมื่อไม่มีงานประมวลผล&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developers.cloudflare.com\&sz=32)

Cloudflare Durable Objects docs

+1



## 8. Queue Engine และกฎการเล่นเพลง

ส่วนนี้เป็นแกนหลักของระบบ เพราะต้องแยกการจัดคิวใน Backend ออกจากสถานะการเล่นจริงของ YouTube Player

### 8.1 Queue Invariants

กำหนดกฎที่ระบบต้องรักษาเสมอ:

1. หนึ่งห้องมีเพลงสถานะ `playing` ได้ไม่เกินหนึ่งเพลง
2. เพลงในคิวมีลำดับที่แน่นอนและไม่เปลี่ยนเพราะ Client reconnect
3. ทุกการเปลี่ยนคิวมี `queue_version` เพิ่มขึ้น
4. คำขอที่บันทึกสำเร็จแล้วจะไม่หายเพียงเพราะ WebSocket ขาดการเชื่อมต่อ
5. Player ที่ reconnect ต้องอ่าน snapshot ก่อนดำเนินการต่อ
6. การเล่นไม่ได้จะต้องไม่ทำให้คิวหยุดค้างถาวร

### 8.2 State Machine

\#chatgpt-mermaid-\_r_1so\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_1so\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1so\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1so\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1so\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_1so\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_1so\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_1so\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_1so\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_1so\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_1so\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1so\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1so\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_1so\_ p{margin:0;}#chatgpt-mermaid-\_r_1so\_ defs [id$="-barbEnd"]{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1so\_ g.stateGroup text{fill:rgb(31, 78, 148);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_1so\_ g.stateGroup text{fill:rgb(237, 237, 237);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_1so\_ g.stateGroup .state-title{font-weight:bolder;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ g.stateGroup rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_1so\_ g.stateGroup line{stroke:rgb(175, 175, 175);stroke-width:1;}#chatgpt-mermaid-\_r_1so\_ .transition{stroke:rgb(175, 175, 175);stroke-width:1;fill:none;}#chatgpt-mermaid-\_r_1so\_ .stateGroup .composit{fill:transparent;border-bottom:1px;}#chatgpt-mermaid-\_r_1so\_ .stateGroup .alt-composit{fill:#e0e0e0;border-bottom:1px;}#chatgpt-mermaid-\_r_1so\_ .state-note{stroke:rgb(58, 132, 63);fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1so\_ .state-note text{fill:rgb(237, 237, 237);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_1so\_ .stateLabel .box{stroke:none;stroke-width:0;fill:rgb(9, 23, 44);opacity:0.5;}#chatgpt-mermaid-\_r_1so\_ .edgeLabel .label rect{fill:rgb(9, 23, 44);opacity:0.5;}#chatgpt-mermaid-\_r_1so\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_1so\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1so\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_1so\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ .label div .edgeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ .stateLabel text{fill:rgb(237, 237, 237);font-size:10px;font-weight:bold;}#chatgpt-mermaid-\_r_1so\_ .node circle.state-start{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1so\_ .node .fork-join{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1so\_ .node circle.state-end{fill:rgb(31, 78, 148);stroke:transparent;stroke-width:1.5;}#chatgpt-mermaid-\_r_1so\_ .end-state-inner{fill:transparent;stroke-width:1.5;}#chatgpt-mermaid-\_r_1so\_ .node rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_1so\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_1so\_ [id$="-barbEnd"]{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_1so\_ .statediagram-cluster rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_1so\_ .cluster-label,#chatgpt-mermaid-\_r_1so\_ .nodeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ .statediagram-cluster rect.outer{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_1so\_ .statediagram-state .divider{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_1so\_ .statediagram-state .title-state{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_1so\_ .statediagram-cluster.statediagram-cluster .inner{fill:transparent;}#chatgpt-mermaid-\_r_1so\_ .statediagram-cluster.statediagram-cluster-alt .inner{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1so\_ .statediagram-cluster .inner{rx:0;ry:0;}#chatgpt-mermaid-\_r_1so\_ .statediagram-state rect.basic{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_1so\_ .statediagram-state rect.divider{stroke-dasharray:10,10;fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_1so\_ .note-edge{stroke-dasharray:5;}#chatgpt-mermaid-\_r_1so\_ .statediagram-note rect{fill:rgb(48, 48, 48);stroke:rgb(58, 132, 63);stroke-width:1px;rx:0;ry:0;}#chatgpt-mermaid-\_r_1so\_ .statediagram-note rect{fill:rgb(48, 48, 48);stroke:rgb(58, 132, 63);stroke-width:1px;rx:0;ry:0;}#chatgpt-mermaid-\_r_1so\_ .statediagram-note text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ .statediagram-note .nodeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ .statediagram .edgeLabel{color:red;}#chatgpt-mermaid-\_r_1so\_ [id$="-dependencyStart"],#chatgpt-mermaid-\_r_1so\_ [id$="-dependencyEnd"]{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);stroke-width:1;}#chatgpt-mermaid-\_r_1so\_ .statediagramTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].statediagram-cluster rect{fill:rgb(9, 23, 44);stroke:url(#chatgpt-mermaid-\_r_1so\_-gradient);stroke-width:1;}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].statediagram-cluster rect.outer{rx:5px;ry:5px;filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1so\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_1so\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_1so\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_1so\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_1so\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1so\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_1so\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1so\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}queuedplayingremovedrejectedplayedskippedPlayer starts songAdmin removesRejectedEndedAdmin skipsPlayback failed

สถานะ `playing` เป็นสถานะเชิงตรรกะของระบบ ไม่ใช่หลักฐานที่รับรองจาก YouTube ว่าเสียงกำลังดังจริงเสมอไป ต้องเก็บสถานะ Player แยก เช่น `UNSTARTED`, `PLAYING`, `PAUSED`, `BUFFERING`, `ENDED` และ `ERROR`

### 8.3 การจัดการเพลงถัดไป

เมื่อเพลงจบ:

1. Player ส่ง event ว่า YouTube รายงาน `ENDED`
2. Backend ตรวจว่าตรงกับเพลงและ playback session ปัจจุบัน
3. เปลี่ยนเพลงเดิมเป็น `played`
4. เลือกเพลง `queued` ลำดับแรก
5. บันทึกการเปลี่ยนแปลงและ event ใน transaction
6. แจ้ง Player ให้โหลดเพลงใหม่
7. Player ทดลองเล่นและรายงานผล

ข้อควรระวัง: ห้ามเชื่อข้อความ `ENDED` จาก Client ใด ๆ โดยไม่ตรวจ session และเพลงปัจจุบัน มิฉะนั้นผู้ใช้ทั่วไปอาจส่งข้อความปลอมเพื่อเลื่อนคิวได้

### 8.4 ป้องกันปัญหาเพลงถูกเล่นซ้ำ

ให้ Player มี `playbackSessionId` และ `songId` ประจำการเล่นแต่ละครั้ง คำสั่ง `next` ต้องระบุ session ที่ต้องการเปลี่ยน หากคำสั่งเก่าถูกส่งซ้ำ Server ต้องไม่ข้ามเพลงใหม่ซ้ำอีกรอบ

## 9. YouTube Integration

ใช้ YouTube IFrame Player API ซึ่งรองรับการควบคุม Player ผ่าน JavaScript และ event เช่น การเริ่มเล่น การหยุด และการจบเพลง&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developers.google.cn\&sz=32)

Google for Developers

+1



### 9.1 การตรวจ URL

ยอมรับ URL รูปแบบที่กำหนดไว้เท่านั้น เช่น:

- `youtube.com/watch?v=VIDEO_ID`
- `youtu.be/VIDEO_ID`
- `youtube.com/shorts/VIDEO_ID`
- `youtube.com/embed/VIDEO_ID`

ตรวจ hostname แบบตรงตัว ไม่ใช้เพียง `includes("youtube.com")` เพราะ URL ที่ผู้โจมตีสร้างอาจมีข้อความดังกล่าวอยู่ใน hostname หรือ path ได้

ตัวอย่าง logic:

```

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

function extractVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "https:") return null;
    if (!YOUTUBE_HOSTS.has(url.hostname)) return null;

    let id: string | null = null;

    if (url.hostname === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(
        /^\/(embed|shorts)\/([A-Za-z0-9_-]+)\/?$/
      );
      id = match?.[2] ?? null;
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

```

ฟังก์ชันนี้ตรวจรูปแบบเบื้องต้นเท่านั้น ไม่ได้พิสูจน์ว่าวิดีโอมีอยู่จริง ดูได้จาก API และต้องทดสอบกับ URL ที่ยอมรับในระบบจริงเพิ่มเติม

### 9.2 Autoplay Policy

นี่เป็นข้อจำกัดสำคัญของระบบที่ต้องรู้ตั้งแต่ต้น

การส่งเพลงเข้า Queue อัตโนมัติ ไม่ได้รับประกันว่า Browser จะเล่นเพลงพร้อมเสียงโดยอัตโนมัติ โดยเฉพาะเมื่อ Player เพิ่งเปิดใหม่ หรือ Browser บล็อกการเล่นที่ไม่มี user gesture

แนวทางที่แนะนำ:

1. เปิด Player บนเครื่องที่ต่อจอใหญ่
2. แสดงปุ่ม `Start Jukebox`
3. ให้ผู้จัดงานคลิกปุ่มนี้หนึ่งครั้งเพื่อเริ่ม session
4. เมื่อมีเพลงถัดไป ให้ระบบเรียก `loadVideoById()` และ `playVideo()`
5. รองรับ event `onAutoplayBlocked` โดยแสดงข้อความให้ผู้ดูแลกดเริ่มเล่นอีกครั้ง
6. หาก YouTube ส่ง error ให้แสดงสถานะและข้ามเพลงตามนโยบาย

แม้ผู้ดูแลจะกดเริ่มเล่นครั้งแรกแล้ว ก็ยังไม่ควรรับประกันว่าการเล่นทุกเพลงจะทำงานอัตโนมัติได้ตลอดเวลา เพราะนโยบาย Browser และข้อจำกัดของวิดีโอแต่ละรายการมีผลต่อการเล่น&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developers.google.cn\&sz=32)

Google for Developers

+1



### 9.3 Metadata และข้อมูลเพลง

MVP ควรเริ่มจากการเก็บ `videoId` แล้วแสดงชื่อวิดีโอเมื่อได้รับข้อมูลจากแหล่งที่เหมาะสม หากต้องใช้ YouTube Data API ต้องพิจารณา API key, quota และข้อกำหนดของบริการแยกต่างหาก

อย่าพึ่งพาการดึง HTML ของหน้า YouTube มาวิเคราะห์โดยตรง เพราะเป็นวิธีที่เปราะบางและอาจเปลี่ยนแปลงได้

## 10. Security Specification

เนื่องจากผู้ขอเพลงเป็น Anonymous ระบบจึงต้องออกแบบให้คนที่รู้ URL ห้องสามารถขอเพลงได้ แต่ไม่มีสิทธิ์ควบคุมระบบ

| ความเสี่ยง            | มาตรการ                                             |
| --------------------- | --------------------------------------------------- |
| Spam requests         | Rate limit, cooldown และจำกัดจำนวนเพลงในคิว         |
| URL ปลอม              | Parse URL ด้วย allowlist และ validate Video ID      |
| ปลอมเป็น Admin        | Authentication และ authorization ฝั่ง Backend       |
| WebSocket ปลอม Origin | ตรวจ Origin และตรวจสิทธิ์ก่อน Upgrade               |
| ส่ง event ปลอม        | Server เป็นผู้สร้าง event สำคัญเท่านั้น             |
| Request ซ้ำ           | Idempotency key และ unique constraints              |
| SQL injection         | ใช้ prepared statements และ bind parameters         |
| XSS                   | Render ข้อความเป็น text, หลีกเลี่ยง HTML จากผู้ใช้  |
| ลบเพลงผิดห้อง         | ตรวจทั้ง `room_id` และ `song_id`                    |
| คำสั่ง Admin ซ้ำ      | Idempotent commands และ playback session IDs        |
| คิวถูกแก้พร้อมกัน     | Transaction, version และ Room Coordinator           |
| ข้อมูล Admin รั่ว     | เก็บ secrets ในระบบจัดการ secrets ไม่ใส่ใน frontend |

### 10.1 ค่าเริ่มต้นสำหรับ Rate Limit

ค่าต่อไปนี้เป็นค่าตั้งต้นสำหรับการทดสอบ ไม่ใช่ข้อจำกัดที่รับประกันว่าจะป้องกันการโจมตีได้ทั้งหมด

- ส่งคำขอเพลงไม่เกิน 5 ครั้งต่อนาทีต่อ key ที่ระบบกำหนด
- เว้นระยะอย่างน้อย 5 วินาทีระหว่างการเพิ่มเพลงสำเร็จของผู้ขอรายเดียวกัน
- จำกัดจำนวนเพลง `queued` ต่อห้อง เช่น 100 เพลง
- จำกัดจำนวน WebSocket connections ต่อห้องตามขนาดกิจกรรม
- จำกัดขนาด JSON body เช่น 8 KB สำหรับ endpoint ส่งเพลง

ในระบบ Anonymous ไม่มีบัญชีผู้ใช้ให้ระบุว่าใครคือผู้ขอที่แท้จริง ดังนั้น cooldown ที่อิง token หรือ browser session อาจถูกหลีกเลี่ยงได้ และ IP-based limit อาจกระทบผู้ใช้หลายคนที่ใช้เครือข่ายเดียวกัน

Cloudflare Rate Limiting binding มีลักษณะเป็น approximate และอาจยอมให้ request เกิน threshold ได้ระหว่างการกระจายตัวนับ หากต้องการ limit แบบเข้มงวดต่อห้อง ให้ประสานการตรวจและเพิ่มตัวนับผ่าน Durable Object&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developers.cloudflare.com\&sz=32)

Cloudflare Workers docs

+1



### 10.2 Admin Authentication

สำหรับ MVP แนะนำให้ใช้ระบบ Login ที่รองรับ OIDC หรือ Google Sign-In ผ่าน Backend และเก็บความสัมพันธ์ของผู้ใช้กับห้องใน `admins`

- Cookie session ควรใช้ `HttpOnly`, `Secure` และ `SameSite` ที่เหมาะสม
- คำสั่งที่ใช้ Cookie ต้องมีการป้องกัน CSRF
- ตรวจสิทธิ์ทุกครั้งที่เรียก Admin API
- ห้ามเก็บ Admin secret ไว้ใน JavaScript ที่ส่งให้ Browser
- จำกัดการสร้างห้องและเพิ่ม Admin ให้กับผู้มีสิทธิ์เท่านั้น

### 10.3 Privacy

- ไม่เก็บชื่อผู้ขอเป็นค่าเริ่มต้น
- ไม่บังคับให้ระบุอีเมลหรือสมัครสมาชิก
- เก็บข้อมูลที่จำเป็นต่อการจัดคิวและป้องกันสแปมเท่านั้น
- กำหนด retention สำหรับ event log และข้อมูล session
- ระบุใน Privacy Notice ว่ามีการประมวลผลข้อมูลใดบ้างและเพื่ออะไร

## 11. Deployment Specification

### 11.1 Environment แยกตามขั้นตอน

| Environment | วัตถุประสงค์            | ข้อมูล                               |
| ----------- | ----------------------- | ------------------------------------ |
| Local       | พัฒนาและทดสอบ           | Local D1 + Local Worker              |
| Preview     | ตรวจ UI และ Integration | ฐานข้อมูลทดสอบแยก                    |
| Production  | ใช้ในกิจกรรมจริง        | D1, Durable Objects และ secrets จริง |

ห้ามใช้ฐานข้อมูล Production ในการทดสอบ migration หรือคำสั่งล้างคิวโดยไม่ตั้งใจ

### 11.2 การตั้งค่า Cloudflare

```

# workers/api/wrangler.toml

name = "qr-music-api"
main = "src/index.ts"
compatibility_date = "2026-10-22"

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "qr-music-db"
database_id = "REPLACE_WITH_DATABASE_ID"
migrations_dir = "../../migrations"

[[durable_objects.bindings]]
name = "ROOM_COORDINATOR"
class_name = "RoomCoordinator"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RoomCoordinator"]

```

นี่เป็นตัวอย่างโครงสร้าง config เบื้องต้น ต้องตรวจ syntax และ migration support ให้ตรงกับ Wrangler เวอร์ชันที่ติดตั้งก่อน deploy จริง โดยเฉพาะกรณีที่มี Durable Objects อยู่แล้วและเพิ่ม class ใหม่ภายหลัง

Cloudflare มี Bindings สำหรับเชื่อม Workers กับ D1 และ Durable Objects โดยตรง จึงไม่จำเป็นต้องนำ credential ของฐานข้อมูลไปเก็บไว้ใน Frontend&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developers.cloudflare.com\&sz=32)

Cloudflare Workers docs

+1



### 11.3 ขั้นตอน Deploy

```

# 1. ติดตั้ง dependencies
npm install

# 2. สร้างฐานข้อมูล D1
npx wrangler d1 create qr-music-db

# 3. ทดสอบ migration ใน local
npx wrangler d1 migrations apply qr-music-db --local

# 4. ทดสอบ Worker
npx wrangler dev

# 5. ตรวจ TypeScript และ Build
npm run typecheck
npm run build

# 6. Apply migration ใน Production
npx wrangler d1 migrations apply qr-music-db --remote

# 7. Deploy Worker
npx wrangler deploy

```

คำสั่ง deploy Frontend ต้องรันจาก package ของ Frontend ตาม configuration ที่เลือกไว้ ส่วนขั้นตอน D1 และ Durable Objects ต้องตรวจ resource IDs และ environment ให้ตรงกันก่อนเสมอ

### 11.4 Domain Design

แนะนำให้ใช้โดเมนเดียวกันหรือ subdomain ที่ควบคุมได้ เช่น:

- `music.example.com` — Frontend
- `api.example.com` — Backend API และ WebSocket

การใช้ same-site deployment ช่วยลดความซับซ้อนด้าน CORS และ Cookie หากแยก subdomain ต้องกำหนด Origin allowlist, CORS และ cookie scope ให้เหมาะสม ไม่ใช้ `Access-Control-Allow-Origin: *` ร่วมกับ credential

## 12. Repository Structure

โครงสร้างนี้แยกส่วน Frontend, API และ Queue Coordinator ออกจากกัน โดยใช้ TypeScript ร่วมกัน

```

qr-music/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── pages/
│       │   │   ├── RequestPage.tsx
│       │   │   ├── PlayerPage.tsx
│       │   │   ├── AdminPage.tsx
│       │   │   └── RoomDashboardPage.tsx
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── queue/
│       │   │   ├── player/
│       │   │   ├── room/
│       │   │   └── admin/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── styles/
│       └── package.json
├── workers/
│   └── api/
│       └── src/
│           ├── routes/
│           ├── middleware/
│           ├── services/
│           ├── repositories/
│           ├── durable-objects/
│           │   └── RoomCoordinator.ts
│           ├── schemas/
│           └── index.ts
├── packages/
│   └── shared/
│       └── src/
│           ├── api-types.ts
│           ├── events.ts
│           └── constants.ts
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── websocket/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── security.md
│   └── deployment.md
├── package.json
└── README.md

```

หลักการแบ่งความรับผิดชอบ:

- `routes/` รับ HTTP request และตรวจ schema
- `services/` ใช้กฎทางธุรกิจ เช่น Queue Engine
- `repositories/` ติดต่อ D1 ด้วย prepared statements
- `durable-objects/` จัดการ WebSocket และประสานงานต่อห้อง
- `packages/shared/` เก็บ TypeScript types ที่ใช้ร่วมกัน
- `features/player/` จัดการ YouTube Player API โดยไม่ผูกกับฐานข้อมูลโดยตรง

## 13. แผนพัฒนา

แนะนำให้พัฒนาตาม dependency ของระบบ ไม่เริ่มจาก UI ที่ซับซ้อนก่อนพิสูจน์ว่า Queue Engine ทำงานถูกต้อง

Phase 0 — Architecture & Setup

ประมาณ 1–2 วัน

- กำหนด route และ shared types
- สร้าง repository และ CI
- ตั้งค่า D1 และ Durable Objects
- ทำ migration แรกและ health endpoint

เกณฑ์ผ่าน: API deploy ได้ และ migration ทำงานใน local

Phase 1 — Room & Queue Engine

ประมาณ 2–4 วัน

- สร้างห้องและ room code
- ส่งเพลงและดึงคิว
- เพิ่ม transaction, idempotency และ validation
- ทดสอบ concurrent requests

เกณฑ์ผ่าน: ส่งเพลงพร้อมกันได้โดยไม่ทำให้คิวเสียลำดับ

Phase 2 — WebSocket

ประมาณ 2–3 วัน

- เชื่อมต่อ Client เข้าห้อง
- Broadcast queue events
- รองรับ reconnect และ resync
- ป้องกัน event ซ้ำและ event เก่า

เกณฑ์ผ่าน: เปิดหลาย Browser แล้วเห็นลำดับคิวตรงกัน

Phase 3 — YouTube Player

ประมาณ 2–4 วัน

- สร้าง Player adapter
- ทำปุ่ม Start Playback
- เชื่อม event กับ Queue Engine
- จัดการ Error, Ended และ Autoplay blocked

เกณฑ์ผ่าน: เพลงจบแล้วเปลี่ยนไปเพลงถัดไปได้ และกู้คืนหลัง reconnect ได้

Phase 4 — Dark Jukebox UI

ประมาณ 3–5 วัน

- Request, Player และ Admin
- QR Code และ Mobile-first layout
- Loading, Empty, Error และ Offline states
- Fullscreen และ Accessibility

เกณฑ์ผ่าน: ผู้ร่วมงานใช้งานได้โดยไม่ต้องอธิบายขั้นตอนซับซ้อน

Phase 5 — Security & Release

ประมาณ 2–4 วัน

- Admin authentication
- Rate limiting และ WebSocket validation
- E2E tests และ production migration
- Logs, monitoring และ rollback plan

เกณฑ์ผ่าน: ทดสอบหลายห้องและทดสอบกรณีผิดพลาดครบ

ระยะเวลาเป็นการประมาณสำหรับผู้พัฒนาหนึ่งคนที่คุ้นเคยกับ React และ Cloudflare แล้ว โดยไม่รวมเวลารอแก้ปัญหาจากข้อจำกัดของ YouTube หรือการตั้งค่าบัญชี Cloudflare

## 14. Test Plan และ Acceptance Criteria

ก่อนนำไปใช้ในงานจริง ให้ตรวจรายการต่อไปนี้

## Release Checklist

0/19 ผ่านการตรวจ

Queue correctness

ห้อง A และ B มีคิวแยกกันจริง

ส่งเพลงพร้อมกันแล้วลำดับคิวถูกต้อง

Request เดิมที่ retry ไม่สร้างเพลงซ้ำ

เพลงในคิวหนึ่งห้องไม่ถูกลบหรือเล่นในอีกห้อง

มีเพลง playing ได้ไม่เกินหนึ่งเพลงต่อห้อง

Realtime & recovery

Client ใหม่ได้รับ snapshot ที่ถูกต้อง

WebSocket หลุดแล้วเชื่อมต่อกลับได้

Event ซ้ำหรือ version เก่าไม่ทำให้คิวถอยหลัง

Restart Coordinator แล้วคิวกู้คืนจากข้อมูลถาวรได้

Player behavior

ผู้ดูแลเริ่มเล่นเพลงแรกได้

เพลงจบแล้วเลือกเพลงถัดไปถูกต้อง

วิดีโอเล่นไม่ได้แล้วระบบไม่ค้าง

Autoplay ถูกบล็อกแล้วมีวิธีแก้ไข

Player ที่ reconnect ไม่ทำให้เพลงถูกข้ามซ้ำ

Security & usability

ผู้ใช้ทั่วไปเรียก Admin API ไม่สำเร็จ

Origin ที่ไม่อนุญาตเชื่อม WebSocket ไม่ได้

URL ที่ไม่ใช่ YouTube ถูกปฏิเสธ

Rate limit ทำงานเมื่อส่งคำขอถี่เกิน

หน้า Request ใช้งานได้บนมือถือและแสดงข้อผิดพลาดชัดเจน

ล้างผลตรวจคัดลอก Checklist

## 15. ความเสี่ยงและการตัดสินใจทางเทคนิค

| ประเด็น            | แนวทางที่เลือก                                                   |
| ------------------ | ---------------------------------------------------------------- |
| Queue consistency  | D1 เป็นแหล่งข้อมูลถาวร และใช้ Room Coordinator ประสานงาน         |
| Realtime           | Durable Objects WebSocket                                        |
| Anonymous abuse    | Rate limit, queue cap, validation และ moderation                 |
| Playback blocked   | ให้ผู้ดูแลกด Start Playback และมี recovery UI                    |
| Player หลายเครื่อง | กำหนดให้มี Primary Player ต่อห้อง                                |
| Duplicate events   | `queue_version`, idempotency และ playback session                |
| การล่มของระบบ      | Snapshot recovery และตรวจสถานะเมื่อ reconnect                    |
| Privacy            | ไม่เก็บชื่อผู้ขอเป็นค่าเริ่มต้น                                  |
| ค่าใช้จ่าย         | เริ่มด้วย Free tier ได้หากอยู่ในโควตา แต่ต้องติดตามการใช้งานจริง |

### ข้อเสนอแนะเพิ่มเติม: Primary Player ต่อห้อง

แม้จะเปิดหน้า Player ได้หลายเครื่อง แต่ใน MVP ควรกำหนดให้มี Primary Player เพียงเครื่องเดียวต่อห้อง ที่ได้รับสิทธิ์รายงานสถานะการเล่นและเปลี่ยนเพลงอัตโนมัติ

หากเครื่องนั้นหลุด ระบบควรแจ้ง Admin ให้เปิด Player ใหม่หรือกำหนดเครื่องสำรอง การปล่อยให้ Player ทุกเครื่องเปลี่ยนเพลงเองอาจทำให้คิวเลื่อนไม่ตรงกัน

## 16. สรุปสถาปัตยกรรมที่เลือก

- Frontend: React + Vite + TypeScript + Tailwind CSS
- API: Cloudflare Workers + Hono
- Database: Cloudflare D1
- Realtime: Durable Objects + WebSocket
- Playback: YouTube IFrame Player API
- Authentication: OIDC / Google Sign-In สำหรับ Admin
- Request identity: Anonymous พร้อมมาตรการป้องกันสแปม
- Queue model: FIFO พร้อม `queue_version` และ transaction
- Deployment: Cloudflare Pages + Workers + D1 + Durable Objects

ลำดับที่ควรลงมือจริงคือ Room/Queue Engine → REST API → WebSocket → YouTube Player → UI → Security & Deployment เพราะความถูกต้องของคิวและการกู้คืนสถานะเป็นพื้นฐานของระบบทั้งหมด

### เอกสารอ้างอิงทางการ

- [Cloudflare — Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/?utm_source=chatgpt.com)
- [Cloudflare — Workers Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/?utm_source=chatgpt.com)
- [Cloudflare — Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/?utm_source=chatgpt.com)
- [YouTube — IFrame Player API](https://developers.google.com/youtube/iframe_api_reference?utm_source=chatgpt.com)
- [YouTube — Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters?utm_source=chatgpt.com)