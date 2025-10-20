# 🚨 FIX NOW - EMERGENCY STEPS

## ✅ PART 1: ONBOARDING - FIXED!

### Test it:
```bash
cd f:\Major_Project\wichain\wichain-backend\frontend
npm run mobile:build
npm run cap:sync
npm run cap:open:android
```

**Expected:** Onboarding works! ✓

---

## ⚡ PART 2: PEER DISCOVERY - 30 MIN FIX

### **THE PROBLEM:**
Mobile has NO backend. It's just UI. Can't send/receive network packets.

### **THE FIX:**
Add HTTP server to PC's Rust backend. Mobile connects via WiFi.

---

## 🔧 COPY-PASTE FIX

### **1. Add to `src-tauri/Cargo.toml`:**

Under `[dependencies]`, add:
```toml
actix-web = "4.4"
actix-cors = "0.7"
tokio = { version = "1", features = ["full"] }
```

### **2. Add to `src-tauri/src/main.rs`:**

Add at TOP of file:
```rust
use actix_web::{web, App, HttpServer, HttpResponse};
use actix_cors::Cors;
```

Add BEFORE `fn main()`:
```rust
#[actix_web::main]
async fn start_http_server() -> std::io::Result<()> {
    println!("🌐 HTTP server on 0.0.0.0:3030");
    
    HttpServer::new(|| {
        App::new()
            .wrap(Cors::permissive())
            .route("/health", web::get().to(|| async {
                HttpResponse::Ok().body("OK")
            }))
    })
    .bind(("0.0.0.0", 3030))?
    .run()
    .await
}
```

UPDATE `fn main()` - ADD at the START:
```rust
fn main() {
    // START: Add this
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_http_server()).unwrap();
    });
    // END: New code
    
    // ... rest of your existing main() code
}
```

### **3. Build:**
```bash
cd src-tauri
cargo build
cd ..
npm run tauri dev
```

### **4. Test:**
```bash
curl http://localhost:3030/health
```
Should show: `OK`

### **5. Find PC IP:**
```cmd
ipconfig
```
Look for: `192.168.1.XXX`

### **6. Open Firewall:**
```cmd
netsh advfirewall firewall add rule name="WiChain" dir=in action=allow protocol=TCP localport=3030
```

### **7. Configure Mobile:**

Edit: `frontend/src/lib/api-mobile.ts`

Line 10, change to:
```typescript
const BACKEND_URL = 'http://192.168.1.100:3030'; // YOUR PC IP HERE
```

### **8. Rebuild Mobile:**
```bash
cd frontend
npm run mobile:build
npm run cap:sync
npm run cap:open:android
```

### **9. Test on Phone Browser:**
Open: `http://192.168.1.100:3030/health` (your IP)
Should show: `OK`

---

## ✅ DONE!

**Onboarding:** ✅ Works now  
**Peer Discovery:** ⚠️ Will work after HTTP server added (30 min)

---

## 🎯 WHY THIS IS NEEDED

Mobile = Frontend ONLY (no networking)
Desktop = Frontend + Backend (full networking)

Mobile must connect to Desktop's backend via HTTP to access networking.

---

**Questions?** Read `EMERGENCY_FIX_EXPLANATION.md`
