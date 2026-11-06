// script.js
let data = []; // 1. เปลี่ยนเป็น Array ว่าง เพื่อรอรับข้อมูลจริงจาก DB

const list = document.getElementById("list");

// 2. ฟังก์ชันดึงข้อมูลจาก Backend API
async function loadProperties() {
    try {
        const response = await fetch('http://localhost:5000/api/properties');
        const result = await response.json();

        if (result.success) {
            data = result.data; // นำข้อมูลจาก MySQL มาเก็บในตัวแปร data
            showData(data);      // สั่งแสดงผล
        }
    } catch (error) {
        console.error("เชื่อมต่อ Backend ไม่สำเร็จ:", error);
    }
}

// 3. ฟังก์ชันแสดงผล (โค้ดเดิมของคุณ ปรับชื่อฟิลด์ให้ตรงกับ DB)
function showData(items) {
    if (!list) return;
    list.innerHTML = "";
    items.forEach(item => {
        list.innerHTML += `
            <div class="card">
                <h3>${item.title || item.name}</h3>
                <p>${item.priceMonthly || item.price} บาท</p>
                <button onclick="addFav(${item.propertyId || item.id})">❤️ Favorite</button>
            </div>
        `;
    });
}

// 4. ฟังก์ชันกดปุ่มหัวใจ (โค้ดเดิมของคุณ)
function addFav(id) {
    alert("เพิ่มในรายการโปรดแล้ว (ID: " + id + ")");
}

// 5. ระบบค้นหา (โค้ดเดิมของคุณ)
const searchInput = document.getElementById("search");
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const value = e.target.value.toLowerCase();
        const filtered = data.filter(d => {
            const name = d.title || d.name || "";
            return name.toLowerCase().includes(value);
        });
        showData(filtered);
    });
}

// 6. เรียกให้ดึงข้อมูลจาก DB ทันทีที่เปิดหน้าเว็บ
document.addEventListener("DOMContentLoaded", loadProperties);