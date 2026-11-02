// Builder Check backend. Paste into script.google.com, attached to a Google spreadsheet.
// 1) Change REVIEW_KEY. 2) Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
const REVIEW_KEY = 'CHANGE-THIS-KEY';
const HEAD = ['id', 'ts', 'name', 'contact', 'region', 'mins', 'code', 'marks'];

function tab_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let t = book.getSheetByName('submissions');
  if (!t) { t = book.insertSheet('submissions'); t.appendRow(HEAD); }
  return t;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const t = tab_();
    const ids = t.getRange(2, 1, Math.max(1, t.getLastRow() - 1), 1).getValues().flat();
    if (d.action === 'submit') {
      if (!d.id || !d.code || String(d.code).length > 45000) return out_({ ok: false });
      if (ids.indexOf(d.id) < 0) {
        t.appendRow([d.id, new Date().toISOString(), String(d.name).slice(0, 200), String(d.contact).slice(0, 200),
          String(d.region || '').slice(0, 200), d.mins || 0, d.code, '']);
      }
      return out_({ ok: true });
    }
    if (d.action === 'mark') {
      if (d.key !== REVIEW_KEY) return out_({ ok: false });
      const i = ids.indexOf(d.id);
      if (i < 0) return out_({ ok: false });
      t.getRange(i + 2, 8).setValue(JSON.stringify(d.marks));
      return out_({ ok: true });
    }
    return out_({ ok: false });
  } finally {
    lock.releaseLock();
  }
}
function doGet(e) {
  if (!e.parameter || e.parameter.action !== 'list' || e.parameter.key !== REVIEW_KEY) return out_({ ok: false });
  const t = tab_();
  const n = t.getLastRow() - 1;
  if (n < 1) return out_({ ok: true, rows: [] });
  const rows = t.getRange(2, 1, n, 8).getValues().map(function (r) {
    return { id: r[0], ts: r[1], name: r[2], contact: r[3], code: r[6], marks: r[7] ? JSON.parse(r[7]) : null };
  });
  return out_({ ok: true, rows: rows });
}
