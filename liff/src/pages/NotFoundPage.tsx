import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
          <div className="text-5xl">🌱</div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            ไม่พบหน้านี้
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            ลิงก์ที่คุณกดอาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายแล้ว
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            ← กลับสู่หน้าแรก
          </Link>
        </div>
      </section>
    </div>
  );
};
