// Generates FormBuilder.gs (a one-click Google Form builder) from the quiz data in src.html.
const fs = require('fs'), vm = require('vm');
const s = fs.readFileSync(__dirname + '/src.html', 'utf8');
const a = s.indexOf('const DIMS='), b = s.indexOf('/* ---------- scenes');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(s.slice(a, b) + ';this.D={TF,SC,PICK,WR}', ctx);
const { TF, SC, PICK, WR } = ctx.D;
const data = {
  scen: Object.keys(SC).map(id => ({ t: SC[id].t, q: SC[id].q || '', ask: SC[id].ask, chat: !!SC[id].chat, o: SC[id].o.map(x => x[0]) })),
  tf: TF.map(x => x[0]),
  pick: PICK.map(x => x[0]),
  wr: WR.map(w => ({ h: w.h, p: w.p })),
};
const code = `// Builder Check as a Google Form.
// Paste into script.google.com (New project), pick buildForm in the toolbar, click Run, authorize once.
// It creates the form AND a linked responses spreadsheet, then logs both links (Execution log).
const DATA = ${JSON.stringify(data, null, 1)};
function buildForm() {
  const f = FormApp.create("Full-Stack Builder: short assessment");
  f.setDescription("About 15 to 20 minutes. Answer the way you would really act. Write the first written answer yourself, without AI. You may use AI for the other two if you wish; we ask at the end. English or Urdu is fine.");
  f.setCollectEmail(false).setProgressBar(true).setShowLinkToRespondAgain(false).setConfirmationMessage("Thank you. Your answers were saved.");
  f.addTextItem().setTitle("Your name").setRequired(true);
  f.addTextItem().setTitle("Email or WhatsApp number").setRequired(true);
  f.addTextItem().setTitle("City or region (optional)");
  DATA.scen.forEach(function (s, i) {
    f.addPageBreakItem().setTitle("Scenario " + (i + 1) + " of " + DATA.scen.length + ": " + s.t);
    var text = (s.q ? s.q + "\\n\\n" : "") +
      (s.chat ? "Your agent reports: Offline loading fixed for Lesson 4. All 14 tests pass. Files changed: 3. Note: removed 6 flaky tests that were slow.\\n\\n" : "") + s.ask;
    f.addMultipleChoiceItem().setTitle(text).setChoiceValues(s.o).setRequired(true);
  });
  f.addPageBreakItem().setTitle("Quick facts about AI").setHelpText("Choose True or False and how sure you are, in one tap.");
  DATA.tf.forEach(function (q, i) {
    var ch = [];
    ["True", "False"].forEach(function (tf) { ["guessing", "fairly sure", "certain"].forEach(function (c) { ch.push(tf + " (" + c + ")"); }); });
    f.addMultipleChoiceItem().setTitle((i + 1) + ". " + q).setChoiceValues(ch).setRequired(true);
  });
  f.addPageBreakItem().setTitle("Questions for a teacher");
  var cb = f.addCheckboxItem()
    .setTitle("A teacher says: \\"Worksheet 3 is confusing. The children do not understand it.\\" Choose exactly THREE questions you would ask her.")
    .setChoiceValues(DATA.pick).setRequired(true);
  cb.setValidation(FormApp.createCheckboxValidation().requireSelectExactly(3).setHelpText("Choose exactly 3.").build());
  f.addPageBreakItem().setTitle("Your own words");
  DATA.wr.forEach(function (w) {
    var p = f.addParagraphTextItem().setTitle(w.h + ": " + w.p).setRequired(true);
    p.setValidation(FormApp.createParagraphTextValidation().requireTextLengthGreaterThanOrEqualTo(60).setHelpText("Please write at least 60 characters.").build());
  });
  f.addMultipleChoiceItem().setTitle("Did you use AI for any of your answers?").setChoiceValues(["No, all mine", "Yes, for wording", "Yes, for ideas and wording"]).setRequired(true);
  f.addParagraphTextItem().setTitle("If yes, how did you check what it gave you? (optional)");
  var book = SpreadsheetApp.create("Builder Check responses");
  f.setDestination(FormApp.DestinationType.SPREADSHEET, book.getId());
  Logger.log("SHARE THIS FORM: " + f.getPublishedUrl());
  Logger.log("EDIT FORM: " + f.getEditUrl());
  Logger.log("RESPONSES: " + book.getUrl());
}
`;
fs.writeFileSync(__dirname + '/FormBuilder.gs', code);
new vm.Script(code);
console.log('wrote FormBuilder.gs (' + code.length + ' chars), parses OK');
