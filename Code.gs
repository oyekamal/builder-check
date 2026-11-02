// Builder Check backend. Paste into Extensions > Apps Script of a Google spreadsheet.
// 1) Change REVIEW_KEY. 2) Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
const REVIEW_KEY = 'CHANGE-THIS-KEY';
const HEAD = ['id', 'ts', 'name', 'contact', 'region', 'mins', 'code', 'marks'];

function tab_(create) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let t = book.getSheetByName('submissions');
  if (!t && create) {
    t = book.insertSheet('submissions');
    t.getRange('A:H').setNumberFormat('@'); // plain text: keeps 0300..., +92..., and stops =formulas
    t.appendRow(HEAD);
  }
  return t;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function str_(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
function keyOk_(k) { return REVIEW_KEY !== 'CHANGE-THIS-KEY' && typeof k === 'string' && k === REVIEW_KEY; }

function doPost(e) {
  let lock = null;
  try {
    const d = JSON.parse(e && e.postData && e.postData.contents);
    if (!d || typeof d !== 'object') return out_({ ok: false, error: 'bad request' });
    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    const t = tab_(true);
    const n = Math.max(0, t.getLastRow() - 1);
    const ids = n ? t.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]); }) : [];

    if (d.action === 'submit') {
      if (typeof d.code === 'string' && d.code.length > 45000) return out_({ ok: false, error: 'too large' });
      const id = str_(d.id, 80), code = str_(d.code, 45000), name = str_(d.name, 200), contact = str_(d.contact, 200);
      if (!id || !code || !name || !contact) return out_({ ok: false, error: 'missing fields' });
      const i = ids.indexOf(id);
      if (i < 0) {
        t.appendRow([id, new Date().toISOString(), name, contact, str_(d.region, 200), Number(d.mins) || 0, code, '']);
      } else {
        const row = i + 2;
        const marked = String(t.getRange(row, 8).getValue() || '') !== '';
        if (!marked) { // a retake replaces the earlier attempt until you have marked it
          t.getRange(row, 2, 1, 6).setValues([[new Date().toISOString(), name, contact, str_(d.region, 200), Number(d.mins) || 0, code]]);
        }
      }
      return out_({ ok: true });
    }
    if (d.action === 'mark') {
      if (!keyOk_(d.key)) return out_({ ok: false, error: 'key' });
      const ok = Array.isArray(d.marks) && d.marks.length === 3 &&
        d.marks.every(function (m) { return m === '' || m === '0' || m === '1' || m === '2' || m === '3'; });
      const i = ids.indexOf(String(d.id));
      if (!ok || i < 0) return out_({ ok: false, error: 'bad mark' });
      t.getRange(i + 2, 8).setValue(JSON.stringify(d.marks));
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: 'server error' });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function doGet(e) {
  try {
    if (!e || !e.parameter || e.parameter.action !== 'list' || !keyOk_(e.parameter.key)) return out_({ ok: false });
    const t = tab_(false);
    const n = t ? t.getLastRow() - 1 : 0;
    if (n < 1) return out_({ ok: true, rows: [] });
    const rows = [];
    t.getRange(2, 1, n, 8).getValues().forEach(function (r) {
      let marks = null;
      try { marks = r[7] ? JSON.parse(r[7]) : null; } catch (x) { marks = null; }
      rows.push({ id: String(r[0]), ts: String(r[1]), name: r[2], contact: r[3], code: r[6], marks: marks });
    });
    return out_({ ok: true, rows: rows });
  } catch (err) {
    return out_({ ok: false });
  }
}
