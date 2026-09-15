# خطوات نشر الكود على Google Apps Script

## الخطوات:

1. افتح مشروع الـ Apps Script بتاعك من:
   `https://script.google.com`

2. امسح الكود القديم في **Code.gs** واستبدله بالكود الجديد الموجود في:
   `C:\Users\my0kr\.gemini\antigravity\scratch\azu-science-portal\Code.gs`

3. اضغط **Deploy → Manage Deployments**

4. اختر الـ Deployment الموجود واضغط **Edit** ثم غيّر الـ **Version** لـ "New version"

5. تأكد إن الـ **Who has access** = **Anyone**

6. اضغط **Deploy** وخد الـ URL الجديد (لو اتغير، حدّثه في `gas-client.js` في المتغير `ENDPOINT_URL`)

## ملاحظة مهمة:
الـ URL بتاعك الحالي مش هيتغير لو اخترت **Deploy as same deployment** ولن تحتاج لتحديث الموقع.
