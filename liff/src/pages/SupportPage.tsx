import { Link } from 'react-router-dom';

const FaqItem = ({ q, a }: { q: string; a: string }) => (
  <details className="group rounded-lg border border-slate-200 bg-white px-4 py-3 transition open:border-brand-200 open:bg-brand-50/50">
    <summary className="cursor-pointer select-none text-sm font-medium text-slate-900">
      {q}
    </summary>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
  </details>
);

export const SupportPage = () => {
  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">วิธีใช้งาน Tina</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          คำถามที่พบบ่อยและเคล็ดลับการใช้งาน
        </p>
        <div className="mt-4 space-y-2">
          <FaqItem
            q="📝 บันทึกอาหารยังไงคะ?"
            a="พิมพ์ชื่ออาหารที่ทานในแชต TinaDiet ได้เลย เช่น &quot;ผัดกะเพราไก่ไข่ดาว&quot; หรือ &quot;ข้าวมันไก่&quot; Tina จะคำนวณแคลให้อัตโนมัติ ส่งหลายอย่างพร้อมกันได้ คั่นด้วย + หรือ ,"
          />
          <FaqItem
            q="📷 ถ่ายรูปอาหารใช้ยังไง?"
            a="ส่งรูปอาหารมาในแชต Tina จะระบุเมนูและคำนวณแคล/โปรตีน/คาร์บ/ไขมัน ให้ ฟีเจอร์นี้สำหรับสมาชิก Premium เท่านั้นค่ะ"
          />
          <FaqItem
            q="⚖️ บันทึกน้ำหนักยังไง?"
            a="พิมพ์ในแชตว่า &quot;ชั่ง 65.5&quot; หรือ &quot;น้ำหนัก 65.5&quot; หรือ &quot;weight 65.5&quot; (มี kg ก็ได้) Tina จะบันทึกและคำนวณเป้าหมายแคลใหม่ให้อัตโนมัติ"
          />
          <FaqItem
            q="📋 ดูสรุปวันนี้ที่ไหน?"
            a="เปิดหน้า Dashboard ในแอป หรือพิมพ์ &quot;วันนี้&quot; ในแชต Tina จะส่งรายการอาหารและรวมแคลให้"
          />
          <FaqItem
            q="💬 ปรึกษาเรื่องโภชนาการได้ไหม?"
            a="ได้ค่ะ! ถามได้ตลอดวันในแชต TinaDiet หรือในหน้า &quot;ถาม Tina&quot; ในแอป Tina จะตอบโดยอิงเป้าหมายและข้อมูลการกินของคุณ ฟีเจอร์นี้สำหรับสมาชิก Premium เท่านั้น"
          />
          <FaqItem
            q="⭐ Premium มีอะไรพิเศษ?"
            a="สมาชิก Premium 150 ฿/เดือน ได้: (1) ถ่ายรูปอาหาร ให้ Tina คำนวณแคล (2) ถาม Tina เรื่องโภชนาการได้ทุกอย่าง ยกเลิกได้ทุกเมื่อ ปลอดภัยด้วย Stripe"
          />
          <FaqItem
            q="🔔 จะได้แจ้งเตือนตอนไหน?"
            a="Tina ส่งสรุปการกินทุกวันเวลา 21:00 น. และสรุปสัปดาห์ทุกเช้าวันจันทร์ และอาจส่งคำแนะนำมื้อต่อไปหลังบันทึกอาหารด้วย"
          />
          <FaqItem
            q="🗑️ ลบบัญชีได้ไหม?"
            a="ได้ค่ะ ไปที่หน้า Profile → Settings → Delete Account ข้อมูลทั้งหมดจะถูกลบถาวร และยกเลิก Premium subscription ทันที"
          />
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">ติดต่อเรา</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          ติดปัญหาหรือมีข้อเสนอแนะ?
        </p>
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/60 p-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl">🛟</span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">
                พิมพ์{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-brand-700 ring-1 ring-brand-200">
                  Support
                </code>{' '}
                ในแชต LINE Tina
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Tina จะตอบอัตโนมัติให้คุณพิมพ์ปัญหาที่ต้องการความช่วยเหลือ
                จากนั้นทีมงาน Tina จะติดต่อกลับโดยเร็วที่สุดค่ะ 💖
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">เกี่ยวกับ</h3>
        <div className="mt-3 space-y-2 text-sm">
          <Link
            to="/settings"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-50"
          >
            <span>⚙️ Settings & Privacy</span>
            <span className="text-slate-400">→</span>
          </Link>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-50"
          >
            <span>📄 Privacy Policy</span>
            <span className="text-slate-400">↗</span>
          </a>
          <a
            href="/terms"
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-50"
          >
            <span>📄 Terms of Service</span>
            <span className="text-slate-400">↗</span>
          </a>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Tina Diet · tinadiet.com
        </p>
      </section>
    </div>
  );
};
