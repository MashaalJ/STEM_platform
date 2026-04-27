const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const COUNT = Number(process.env.COUNT || 50);
const CLASS_ID_INPUT = process.env.CLASS_ID ? Number(process.env.CLASS_ID) : null;
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'teacher@example.com';
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'teacher123';

const parseSetCookie = (headerValue) => {
  if (!headerValue) return '';
  return headerValue
    .split(/,(?=\s*[a-zA-Z0-9_\-]+=)/g)
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
};

const api = async (path, options = {}, cookie = '') => {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { res, json };
};

const main = async () => {
  console.log(`Starting stress test against ${BASE_URL}`);
  const login = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: TEACHER_EMAIL, password: TEACHER_PASSWORD }),
  });
  if (!login.res.ok || !login.json?.success) {
    throw new Error(`Login failed: ${login.res.status} ${JSON.stringify(login.json)}`);
  }
  const cookie = parseSetCookie(login.res.headers.get('set-cookie'));
  if (!cookie) throw new Error('No session cookie returned from login.');

  let classId = CLASS_ID_INPUT;
  if (!classId) {
    const className = `Stress Class ${Date.now()}`;
    const created = await api(
      '/api/classes',
      { method: 'POST', body: JSON.stringify({ name: className, teacher_id: login.json?.user?.id, description: 'stress-test' }) },
      cookie,
    );
    if (!created.res.ok || !created.json?.id) {
      throw new Error(`Class creation failed: ${created.res.status} ${JSON.stringify(created.json)}`);
    }
    classId = Number(created.json.id);
    console.log(`Created class ${classId} (${className})`);
  } else {
    console.log(`Using existing class ${classId}`);
  }

  const names = Array.from({ length: COUNT }, (_, i) => `Stress Student ${String(i + 1).padStart(2, '0')}`);
  const start = Date.now();
  const addMany = await api(
    '/api/classes/add-students-by-names',
    { method: 'POST', body: JSON.stringify({ class_id: classId, names }) },
    cookie,
  );
  const elapsedMs = Date.now() - start;

  if (!addMany.res.ok) {
    throw new Error(`Bulk add failed: ${addMany.res.status} ${JSON.stringify(addMany.json)}`);
  }

  const classes = await api('/api/classes', { method: 'GET' }, cookie);
  const currentClass = Array.isArray(classes.json) ? classes.json.find((c) => Number(c.id) === Number(classId)) : null;

  console.log('--- Stress test result ---');
  console.log(`Students requested: ${COUNT}`);
  console.log(`Added to class: ${addMany.json?.added ?? 0}`);
  console.log(`New accounts created: ${(addMany.json?.created || []).length}`);
  console.log(`Class student_count now: ${currentClass?.student_count ?? 'unknown'}`);
  console.log(`Elapsed: ${elapsedMs} ms`);
  console.log('Done.');
};

main().catch((err) => {
  console.error('Stress test failed:', err.message || err);
  process.exit(1);
});

