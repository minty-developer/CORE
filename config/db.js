import mongoose from 'mongoose';

export async function connectDB() {
    try {
        await mongoose.connect('mongodb://ip주소:27017/DB이름');
        console.log("DB 연결 성공");
    } catch (err) {
        console.error("DB 연결 실패", err);
    }
}