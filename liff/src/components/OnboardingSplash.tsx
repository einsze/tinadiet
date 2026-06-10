type Props = {
  onContinue: () => void;
  displayName: string | null;
};

const FeatureRow = ({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="text-2xl leading-none">{icon}</div>
    <div className="flex-1">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{desc}</p>
    </div>
  </div>
);

export const OnboardingSplash = ({ onContinue, displayName }: Props) => {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-8 text-center text-white shadow-sm">
        <div className="text-6xl leading-none">🌱</div>
        <h2 className="mt-3 text-2xl font-bold">
          {displayName !== null
            ? `สวัสดี ${displayName}`
            : 'สวัสดีค่ะ'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/90">
          ฉันชื่อ <span className="font-semibold">Tina</span> — coach โภชนาการส่วนตัวบน LINE
          <br />
          สำหรับคนไทยที่อยากดูแลตัวเอง ☺️
        </p>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Tina ช่วยอะไรได้บ้าง?</h3>
        <div className="mt-4 space-y-4">
          <FeatureRow
            icon="📷"
            title="ถ่ายรูปอาหาร · นับแคลให้อัตโนมัติ"
            desc="ส่งรูปอาหารมาในแชต Tina ระบุเมนูและคำนวณ kcal, โปรตีน, คาร์บ, ไขมัน ให้เลย"
          />
          <FeatureRow
            icon="💬"
            title="ถามอะไรเกี่ยวกับโภชนาการ"
            desc="ถามได้ตลอดวัน Tina ตอบโดยอิงเป้าหมายและข้อมูลการกินของคุณ"
          />
          <FeatureRow
            icon="📊"
            title="ติดตามน้ำหนัก + เป้าหมายรายวัน"
            desc="ดู kcal ring, macro, กราฟน้ำหนัก, streak การบันทึก — ทั้งหมดในหน้าเดียว"
          />
          <FeatureRow
            icon="🔔"
            title="สรุปรายวันและรายสัปดาห์"
            desc="Tina ส่งสรุปการกินทุก 21:00 และสรุปสัปดาห์ทุกเช้าวันจันทร์"
          />
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-600 active:bg-brand-700"
        >
          เริ่มเลย →
        </button>

        <p className="mt-3 text-center text-xs text-slate-400">
          ขั้นตอนถัดไป: กรอกข้อมูลพื้นฐาน (~1 นาที) เพื่อให้ Tina คำนวณเป้าหมายแคลของคุณ
        </p>
      </section>
    </div>
  );
};
