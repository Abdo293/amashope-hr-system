# Amashope HR System

واجهة عربية لإدارة الموظفين والمشاريع والمهام ومرفقات العمل. يستخدم النظام Supabase Auth/Postgres/RLS وCloudflare R2 للملفات.

## التشغيل محليًا

```bash
cp .env.example .env
npm install
npm run dev
```

متغيرات الواجهة:

```env
VITE_SUPABASE_URL=https://your-supabase-url.example.com
VITE_SUPABASE_ANON_KEY=your-anon-key
```

مفتاح `anon` مصمم للاستخدام في المتصفح، لكن `SUPABASE_SERVICE_ROLE_KEY` ومفاتيح R2 يجب ألا توضع في ملفات Vite أو في المستودع.

## إعداد Supabase

1. طبّق migrations بالترتيب، وآخرها `202609140005_hr_daily_uploads.sql`.
2. انشر Edge Functions: `hr-manage-user` و`hr-r2-storage`.
3. أضف أسرار Edge Functions التالية:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

إنشاء الموظفين لا يعتمد على البريد: ينشئ السيرفر كلمة مرور مؤقتة قوية، يعرضها للأدمن مرة واحدة، ويجبر الموظف على تغييرها عند أول دخول. إعادة التعيين من الأدمن تعمل بالطريقة نفسها.

بما أن الأنظمة تستخدم مشروع Supabase نفسه، فكلمة مرور `auth.users` مشتركة بينها. ربط حساب موجود بالـHR لا يغير كلمته تلقائيًا، لكن إعادة تعيينها من أدمن الـHR تغيّرها للحساب في كل الأنظمة.

## إعداد Cloudflare R2

الـ bucket يجب أن يكون Private. أضف CORS يسمح لنطاق الواجهة بتنفيذ `PUT`، ويسمح بالـ headers المطلوبة ومنها `Content-Type`. التنزيل والرفع يتمان بروابط موقعة قصيرة العمر؛ لا تستخدم Public Bucket URL.

للتجربة المحلية، انسخ محتوى `supabase/r2-cors.local.json` إلى إعداد CORS الخاص بالـbucket. عند النشر أضف رابط واجهة الـHR الحقيقي داخل `AllowedOrigins` من غير `/` أخيرة، واحتفظ بأصول localhost فقط في بيئة التطوير.

أنواع الملفات المدعومة: الصور، PDF، MP4/WebM/MOV، CSV، Word، Excel، PowerPoint، وZIP، مع حدود حجم مطبقة داخل Edge Function.

## إنشاء أول Admin

بعد تطبيق migrations:

```bash
SUPABASE_SERVICE_ROLE_KEY="..." node scripts/create-admin.js \
  admin@example.com 'a-strong-password-of-12+-chars' 'System Admin'
```

السكربت لا يحتوي كلمة مرور افتراضية ولا يطبع كلمة المرور.

## التحقق قبل النشر

```bash
npm run lint
npm run build
node --check scripts/create-admin.js
```

يجب أيضًا اختبار RLS بحساب Admin وحسابي موظفين من مشروعين مختلفين قبل كل نشر لقاعدة البيانات.
