# ใช้ Node.js เวอร์ชันล่าสุดแบบเบา (Alpine)
FROM node:24-alpine

# ตั้งค่า Working Directory ใน Container
WORKDIR /app

# ก็อปปี้ไฟล์ package.json และ package-lock.json เข้าไปก่อนเพื่อ Install Dependencies
COPY package.json package-lock.json* ./

# ติดตั้งแพ็กเกจทั้งหมด (รวมถึง lucide-react, tailwindcss ฯลฯ)
RUN npm install

# ก็อปปี้ไฟล์โปรเจกต์ทั้งหมดเข้าไปใน Container
COPY . .

# เปิดพอร์ต 5173 สำหรับ Vite
EXPOSE 5173

# คำสั่งรันโปรเจกต์ Vite โดยใส่ --host เพื่อให้สามารถเข้าถึงจากภายนอก Container ได้
CMD ["npm", "run", "dev", "--", "--host"]